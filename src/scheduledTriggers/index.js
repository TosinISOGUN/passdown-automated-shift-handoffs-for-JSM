import api, { invokeRemote, route } from '@forge/api';
import { kvs } from '@forge/kvs';
import { summarizeIssue } from '../lib/summarize';

const REMOTE_KEY = 'passdown-sched-remote';

// Runs every 5 minutes (Forge's shortest interval). Shift boundaries almost
// certainly don't align to a fixed interval, so this polls and diffs on-call
// state per schedule rather than trying to compute shift start/end times
// directly -- confirmed pattern, see AGENTS.md.
//
// Schedule reads go through passdown-schedule-remote (a Cloudflare Worker)
// instead of calling the JSM ops API directly with asApp() -- asApp() gets a
// 403 "Account does not have access to Opsgenie" on this API surface,
// confirmed as a real platform issue (see CLAUDE.md's 2026-08-03 entry). The
// remote exchanges the app's system token for a token impersonating the site
// owner, who does have Ops access, then calls api.atlassian.com/ex/jira/
// {cloudId}/... directly (the public gateway base for a bearer-token call
// from outside Forge's own requestJira proxy). Everything else in this file
// (ticket search, comments, reassignment) is plain Jira REST and still uses
// asApp() directly, unchanged.
export async function checkShiftBoundaries({ context } = {}) {
  const cloudId = context?.cloudId;
  if (!cloudId) {
    console.error('No cloudId in scheduled trigger context; cannot call the schedule remote.');
    return;
  }

  const schedules = await listSchedules(cloudId);

  for (const schedule of schedules) {
    try {
      await checkSchedule(schedule.id, cloudId);
    } catch (err) {
      // One schedule failing (bad data, transient API error) should not stop
      // the others from being checked in the same poll.
      console.error(`Failed checking schedule ${schedule.id}:`, err);
    }
  }
}

async function callScheduleRemote(path, cloudId) {
  const qs = `cloudId=${encodeURIComponent(cloudId)}`;
  const response = await invokeRemote(REMOTE_KEY, {
    path: `${path}?${qs}`,
    method: 'GET',
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Schedule remote call failed for ${path} (${response.status}): ${detail}`);
  }

  return response.json();
}

async function listSchedules(cloudId) {
  const body = await callScheduleRemote('/jsm/ops/api/v1/schedules', cloudId);
  return Array.isArray(body.values) ? body.values : [];
}

async function fetchCurrentOnCall(scheduleId, cloudId) {
  const body = await callScheduleRemote(`/jsm/ops/api/v1/schedules/${scheduleId}/on-calls`, cloudId);
  const participants = Array.isArray(body.onCallParticipants) ? body.onCallParticipants : [];
  // A schedule can have multiple simultaneous on-call participants (overlapping
  // rotations). Only single-user on-call is handled in this build -- see
  // CLAUDE.md's "type: user only" assumption.
  return participants.length === 1 ? participants[0] : null;
}

function kvsKey(scheduleId) {
  return `schedule:${scheduleId}:on-call`;
}

async function checkSchedule(scheduleId, cloudId) {
  const current = await fetchCurrentOnCall(scheduleId, cloudId);
  const stored = await kvs.get(kvsKey(scheduleId));

  const currentId = current && current.type === 'user' ? current.id : null;
  const storedId = stored && stored.type === 'user' ? stored.id : null;

  if (!stored) {
    // First time we've seen this schedule -- record a baseline, no boundary to
    // hand off from yet.
    await kvs.set(kvsKey(scheduleId), current);
    return;
  }

  const changed = JSON.stringify(current) !== JSON.stringify(stored);
  if (!changed) return;

  if (storedId && currentId && storedId !== currentId) {
    console.log(`Shift boundary on schedule ${scheduleId}: ${storedId} -> ${currentId}`);
    await handOffTickets(storedId, currentId);
  } else {
    // Either side is a team/escalation (not a single user), or the change was
    // otherwise not a clean user-to-user handoff. Skip processing but still
    // advance the stored state so this doesn't re-trigger every poll.
    console.log(`Schedule ${scheduleId} on-call changed but is not a user-to-user handoff; skipping.`);
  }

  await kvs.set(kvsKey(scheduleId), current);
}

async function handOffTickets(outgoingAccountId, incomingAccountId) {
  const tickets = await fetchOpenAssignedTickets(outgoingAccountId);

  for (const ticket of tickets) {
    try {
      await handOffTicket(ticket.key, incomingAccountId);
    } catch (err) {
      // One ticket failing should not stop the rest of the handoff.
      console.error(`Failed handing off ticket ${ticket.key}:`, err);
    }
  }
}

async function fetchOpenAssignedTickets(accountId) {
  const jql = `assignee = "${accountId}" AND statusCategory != Done`;
  const response = await api.asApp().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jql, fields: ['summary'], maxResults: 100 }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Open-ticket search failed (${response.status}): ${detail}`);
  }

  const body = await response.json();
  return Array.isArray(body.issues) ? body.issues : [];
}

async function handOffTicket(issueKey, incomingAccountId) {
  const result = await summarizeIssue(api.asApp(), issueKey, { style: 'handoff' });
  if (result.empty) return;

  await postHandoffComment(issueKey, result.summary, incomingAccountId);
  await reassignIssue(issueKey, incomingAccountId);
}

// Posts the brief as a native comment with the incoming person mentioned. Per
// CLAUDE.md's resolved decision, this mention is best-effort -- the
// reassignment below is the primary, guaranteed notification signal.
//
// ADF has no meaning for literal "\n" inside a text node -- paragraph breaks
// need their own paragraph nodes -- so the multi-paragraph handoff text is
// split on blank lines into separate paragraphs rather than dumped into one.
async function postHandoffComment(issueKey, summaryText, incomingAccountId) {
  const paragraphs = summaryText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const content = [
    {
      type: 'paragraph',
      content: [
        { type: 'mention', attrs: { id: incomingAccountId } },
        { type: 'text', text: ' shift handoff:' },
      ],
    },
    ...paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
  ];

  const body = {
    body: { type: 'doc', version: 1, content },
  };

  const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Comment post failed for ${issueKey} (${response.status}): ${detail}`);
  }
}

async function reassignIssue(issueKey, incomingAccountId) {
  const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/assignee`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: incomingAccountId }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Reassignment failed for ${issueKey} (${response.status}): ${detail}`);
  }
}
