# Automated shift-handoff brief

## Goal
When an on-call shift ends, every open ticket still assigned to the outgoing person
automatically gets a plain-language "what happened, what's next" comment (with the incoming
person @-mentioned) and is reassigned to the incoming person — no manual step from anyone.
This is Passdown's flagship feature, built on top of the per-ticket summary engine already
shipped and verified.

## Context read
- `products/atlassian/passdown/CLAUDE.md` and `AGENTS.md`, including the 2026-08-02 resolved
  decisions (assignment as primary notification signal, on-call schedule API shape, remote
  scheduled-trigger pattern — not needed here since this stays zero-egress)
- `products/atlassian/passdown/src/resolvers/index.js` (the working per-ticket summary engine
  being extracted and reused, not rewritten)
- Owner decisions this session (2026-08-03): watch every on-call schedule visible to the app
  (no settings UI); a brief covers whatever's currently assigned to the outgoing person and
  not in a Done-category status; bounded Forge KVS storage (one entry per schedule) is
  approved for shift-boundary detection
- Current docs fetched this session: JSM ops schedules/on-calls endpoints, `@forge/kvs`
  (`kvs.set`/`kvs.get`, requires `storage:app` scope), ADF mention node shape
  (`{ type: 'mention', attrs: { id, text } }` inside a paragraph's `content`), and confirmation
  that classic `write:jira-work` (not granular write scopes) is the current recommended scope
  for POST-based writes like comment creation

## Assumptions
- **Shift-boundary detection is poll-and-diff, not schedule-math.** Every 5 minutes (Forge's
  shortest interval), for each schedule read from `GET /jsm/ops/api/{cloudId}/v1/schedules`,
  fetch current on-calls (`.../schedules/{id}/on-calls?flat=true`), and compare the on-call
  user id(s) to what's stored in KVS for that schedule. A change from a *previously known*
  value is a shift boundary; the very first poll for a schedule just records a baseline and
  does nothing (there's no "previous shift" to hand off from). This avoids needing to compute
  shift start/end times from rotation data directly, which the API research this session did
  not fully resolve the shape of.
- **Only `type: "user"` on-call participants are handled in this build.** A schedule whose
  current on-call is a team or an escalation (not a single user) has no single incoming
  person to assign tickets to or mention — skip it and log that it was skipped, rather than
  guessing which team member to notify. This is a real gap, not hidden: worth a follow-up ASK
  if it turns out schedules are commonly team-based rather than per-user.
- **One comment + reassignment per open ticket**, not one consolidated shift report. Re-reading
  `CLAUDE.md`'s wording ("posts it... assign the relevant ticket/thread"), the natural
  technical shape is: for each of the outgoing person's open tickets, generate that ticket's
  own summary (reusing the exact per-ticket engine already shipped) and act on that ticket
  individually. A single merged report with no ticket to live on doesn't fit Jira's model.
- **"Open" means `statusCategory != Done`**, found via JQL on the outgoing person's assigned
  tickets — same status-category concept the per-ticket feature already reads.
- Scheduled-trigger reads/writes run as `asApp()` (confirmed in `AGENTS.md`); the resolver
  keeps using `asUser()` for the on-demand button, unchanged.

## Files to change
- `products/atlassian/passdown/manifest.yml` — add `scheduledTrigger` module (interval
  `fiveMinute`), a new `function` entry for it, and three scopes: `write:jira-work`,
  `read:ops-config:jira-service-management`, `storage:app`.
- NEW `products/atlassian/passdown/src/lib/summarize.js` — the summarization engine
  (`buildTicketFacts`, `generateSummary`, `templateSummary`, `sanitizeText`, `adfToPlainText`,
  the system prompt and data-fence constants) extracted from `resolvers/index.js` so both the
  on-demand button and the scheduled trigger call the same code, parameterized by which `api`
  client (`asUser()` vs `asApp()`) to fetch with.
- `products/atlassian/passdown/src/resolvers/index.js` — updated to import from
  `lib/summarize.js` instead of defining the engine inline; behavior unchanged.
- NEW `products/atlassian/passdown/src/scheduledTriggers/index.js` —
  `checkShiftBoundaries`: lists schedules, diffs on-call state via KVS, and for each detected
  boundary, queries the outgoing person's open tickets and processes each one (summary +
  comment + mention + reassignment).
- `products/atlassian/passdown/src/index.js` — add
  `export { checkShiftBoundaries } from './scheduledTriggers';`

## What this builds
1. **Scheduled trigger** (`interval: fiveMinute`, function-based — no remote/egress needed,
   this stays zero-egress) calls `checkShiftBoundaries`.
2. For each schedule from the schedules list: fetch current on-calls, compare to
   `kvs.get('schedule:{id}:on-call')`.
   - No stored value yet → `kvs.set` the current value, done (baseline, no boundary).
   - Same as stored value → nothing to do.
   - Different, and current participant is `type: "user"` → **shift boundary.** The stored
     value's user is outgoing, the new value's user is incoming. Not a user (team/escalation)
     → skip and log, still update the stored value so it doesn't re-trigger next poll.
3. On a boundary: JQL `assignee = "{outgoingAccountId}" AND statusCategory != Done` (`asApp()`)
   to find the outgoing person's open tickets.
4. For each ticket: run the shared summarization engine's fact-gathering (`asApp()` this
   time), but generate with a **`handoff` style prompt, not the terse on-demand one** — per
   owner direction (2026-08-03): the incoming person needs the full picture, not a one-liner.
   `lib/summarize.js`'s `generateSummary(facts, { style })` takes `'brief'` (existing
   one-paragraph on-demand behavior, unchanged) or `'handoff'` (new): several short
   paragraphs allowed, explicitly structured to cover (a) what happened while they were away,
   in enough detail to actually understand the history, not just a headline, (b) what's
   currently blocking, if anything, (c) exactly what remains to be done and where to pick up
   from. Longer `max_completion_tokens` budget for this style (raise from 512 to ~1024,
   matching Recap's report-length budget) since detail was explicitly requested over brevity.
   Same no-invented-facts, no-marketing-voice, data-fence rules apply to both styles.
5. Post the summary as a native comment in ADF, with the incoming person's mention node
   prepended (`{ type: "mention", attrs: { id: incomingAccountId } }` inside the first
   paragraph, followed by the summary text) — best-effort per the resolved decision that
   mention-triggered notifications aren't guaranteed.
6. **Reassign the ticket to the incoming person** via `PUT
   /rest/api/3/issue/{issueIdOrKey}/assignee` — the primary, guaranteed notification signal.
7. Update `kvs.set('schedule:{id}:on-call', newValue)` once the schedule's tickets are
   processed (or immediately if the participant type was unhandled).
8. Deterministic fallback (same as the per-ticket engine) if the LLM call fails for a given
   ticket — one ticket's failure doesn't block the others in the same boundary event.

## Security
- New scopes: `write:jira-work` (posting comments, reassigning issues — classic scope,
  chosen over granular `write:comment:jira`/`write:issue:jira` because of a confirmed April
  2026 issue where granular write scopes fail on POST requests through the API gateway),
  `read:ops-config:jira-service-management` (reading on-call schedules), `storage:app`
  (KVS). All three are new — the app currently only has `read:jira-work`, so this is a real
  scope-widening that will require `forge install --upgrade`.
- Storage: one bounded KVS entry per on-call schedule (`schedule:{id}:on-call`), holding only
  the current on-call user id(s). Overwritten every poll, never grows, never accumulates
  history — matches `CLAUDE.md`'s no-growing-storage rule.
- `asApp()` used throughout the scheduled trigger (no user in session); `asUser()` unchanged
  for the on-demand button.
- No egress. No third-party calls. Logs stay operational-facts-only (schedule id, boundary
  detected, ticket count processed) — never full comment/summary text, matching the existing
  per-ticket resolver's logging discipline.

## Done when
- `forge lint` passes.
- Manually simulating a shift boundary on the dev site's on-call schedule (change who's
  on-call), the next poll (within 5 minutes) posts a comment with an @-mention and reassigns
  every one of the outgoing person's open tickets to the incoming person — verified against
  real ticket state, not just "a comment appeared."
- A ticket the outgoing person had that's already Done is *not* touched.
- The very first poll after this deploys does not fire a false boundary for schedules it's
  seeing for the first time.
- A schedule whose current on-call is a team/escalation is skipped without erroring, and this
  is visible in `forge logs`.

## Checks
- `forge lint`
- `forge deploy -e development --non-interactive`
- `forge install --upgrade -e development -p Jira -s isogun21.atlassian.net --confirm-scopes --non-interactive`
- `forge logs -e development` to watch the scheduled trigger actually fire

## Verification
1. On the dev site's on-call schedule (Passdown-Test project or wherever one exists), note who
   is currently on-call, and make sure that person has at least one open ticket assigned to
   them.
2. Change the on-call schedule so a different person becomes on-call (simulating a shift
   change) — or, if that's slow to arrange, we can talk through a faster way to simulate this
   for testing once we're here.
3. Wait up to 5 minutes, then check `forge logs -e development` for the trigger firing and
   detecting the boundary.
4. Open the previously-outgoing person's open ticket(s): confirm a new comment appeared with
   an accurate summary and the incoming person mentioned, and that the ticket's Assignee field
   changed to the incoming person.
5. Confirm a Done ticket that was also assigned to the outgoing person was left alone.
6. Report back with screenshots of the posted comment and the reassignment.

## Not in this prompt
Slack/Teams push, pricing/licensing enforcement, listing assets and the marketing site, and
handling of team/escalation-type on-call participants all remain separately scoped, later
work.
