# Passdown — AGENTS.md supplement

This is **not a replacement** for the existing Atlassian AGENTS.md (Forge CLI conventions, UI
Kit component list, module creation, deployment/tunnelling) — that file applies to Passdown
unchanged and should be read first. This supplement covers only what's genuinely new in this
app: scheduled, unattended execution, and JSM-specific reads. Duplicating the generic Forge
rules here would just create two copies to keep in sync every time Forge changes something —
don't do that.

## Scheduled triggers — confirmed syntax and real constraints

```yaml
modules:
  scheduledTrigger:
    - key: shift-boundary-check
      function: checkShiftBoundary
      interval: fiveMinute
functions:
  - key: checkShiftBoundary
    handler: index.checkShiftBoundary
```

**`fiveMinute` is the shortest interval Forge supports** — there is no 1-minute or custom-time
option. Since shift boundaries almost certainly don't align to Forge's fixed intervals (hour,
day, week), the correct pattern is: **poll every five minutes, and use custom logic inside the
function to check whether the current time matches a shift boundary read from the on-call
schedule.** Do not attempt to configure a scheduled trigger for an arbitrary specific time —
that's not a supported interval; the polling-plus-check pattern is the real, documented
workaround, confirmed in Forge's own docs.

Two operational facts worth knowing before debugging trigger timing:
- A trigger's first run starts **about 5 minutes after deployment**, not immediately.
- **Any change to the `scheduledTrigger` block resets all trigger start times.** Don't be
  confused by timing drift after an unrelated manifest edit — it's expected.

## CONFIRMED: scheduled triggers run with no user in session — use `asApp()`

This resolves what `CLAUDE.md` originally listed as an open question, not a guess. Forge's own
scheduled-trigger event payload shows `principal: undefined` — there is no logged-in user
context when a scheduled function fires. **`asApp()` is required for the shift-boundary
check and the resulting comment-post, not a judgement call between `asUser()` and `asApp()`.**
The on-demand per-ticket summary (triggered by a real person clicking something) is the
opposite case and should use `asUser()` as normal, per the shared AGENTS.md's general
preference.

Update `CLAUDE.md`'s "Ask before drafting the first prompt" list to remove this as an open
item — it's settled.

## Posting the comment + mention

The general pattern (confirmed against Forge's own trigger tutorial, adapt rather than copy
verbatim):

```js
import { asApp, route } from "@forge/api";

async function postHandoffComment(issueIdOrKey, message) {
  const requestUrl = route`/rest/api/3/issue/${issueIdOrKey}/comment`;
  const body = {
    body: {
      type: "doc",
      version: 1,
      content: [{ type: "paragraph", content: [{ text: message, type: "text" }] }],
    },
  };
  return asApp().requestJira(requestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
```

**The @-mention itself needs its own verification pass** — the example above posts plain text;
constructing an actual user mention in Atlassian Document Format (ADF) is a different, more
specific content structure. Confirm the correct ADF mention node shape against current docs
before assuming the plain-paragraph example above is sufficient — it isn't, as written; it's
a starting point, not the final mention-capable version.

## CONFIRMED: JSM on-call schedule API shape (resolved 2026-08-02)

Three relevant GET endpoints, all under `/jsm/ops/api/{cloudId}/v1/...` (not the standard
Jira platform REST base — this is the ops/JSM-specific API):

- `schedules` — lists schedules visible to the requesting identity.
- `schedules/{scheduleId}/on-calls` — current on-call participants.
- `schedules/{scheduleId}/next-on-calls` — next on-call participants (shift boundary source).

Response shape: `{ onCallParticipants: [{ id, type: "user"|"team"|"escalation",
forwardedFrom? }] }` (or `nextOnCallParticipants` for the next-on-calls endpoint). Pass
`flat=true` for a plain user-id array instead.

Required scope: `read:ops-config:jira-service-management`.

**Still worth verifying empirically once building starts:** visibility is gated by team
membership / rotation inclusion / escalation membership / admin rights on the *requesting
identity*. The scheduled trigger runs as `asApp()` (see above) — confirm the app's system
identity actually resolves to something with read access to the schedules that matter,
rather than assuming `asApp()` gets admin-equivalent visibility for free.

## Comment mentions from asApp() — treat as best-effort, not the primary signal

No Atlassian documentation confirms an `asApp()`-authored ADF mention triggers the standard
notification pipeline (email/bell/mobile push) the same way a human mention does. Community
reports (not Atlassian-authoritative, but the only signal available) lean toward "may not
reliably notify" for app/system-identity-authored mentions. Per `CLAUDE.md`'s resolved
decision: **build ticket-assignment as the primary, guaranteed notification signal.** Still
post the @-mention in the comment for readability/context, but don't design the feature as if
the mention's notification is guaranteed to fire.

## If the Slack/Teams toggle work begins

The remote-endpoint scheduled-trigger pattern (an `endpoint` property instead of `function`,
with an `auth.appSystemToken` block) is the documented way to have a scheduled trigger call an
external system with a Forge-issued system token. This is more advanced than what the default
zero-egress build needs — only relevant once the admin-opt-in toggle is actually being built,
and even then, confirm it's the current recommended pattern rather than assuming this research
pass is still accurate by the time that work starts.
