# Move schedule-reading to a Forge Remote with offline user impersonation

## Goal
The shift-boundary scheduled trigger actually works: it can read on-call schedule state
instead of failing every poll with a 403 from the JSM Ops API. This unblocks the flagship
shift-handoff feature that was fully built (fact-gathering, handoff prompt, comment posting,
reassignment) but has never successfully run end to end because `asApp()` cannot read
Opsgenie-backed schedule data on this platform (confirmed real, apparently unresolved
platform behavior — see `CLAUDE.md`'s 2026-08-03 entry and the filed community post).

## Context read
- `products/atlassian/passdown/CLAUDE.md`'s 2026-08-03 "egress is opt-in... SUPERSEDED for
  schedule-reading only" section — the owner's explicit, informed sign-off to take on external
  egress and lose default "Runs on Atlassian" eligibility for this feature specifically.
- `products/atlassian/passdown/src/scheduledTriggers/index.js` (the existing, working-except-
  for-schedule-reads logic — `fetchOpenAssignedTickets`, `handOffTicket`,
  `postHandoffComment`, `reassignIssue` all already work under `asApp()` and are **not**
  changing).
- Current docs fetched this session: Forge Remote essentials, calling product APIs from a
  remote, the scheduled-trigger-to-remote manifest pattern (already partially confirmed in
  `AGENTS.md`), and the manifest permissions reference's confirmed scope syntax for
  impersonation (`permissions.scopes` as a map, `allowImpersonation: true` per scope — a
  second, differently-worded source suggested a distinct `offline_impersonation:allowlist`
  scope string, which the authoritative manifest-reference page does not corroborate; treat
  that as incorrect).
- Sweep's Cloudflare Workers setup (`products/shopify/sweep-app`) as the hosting precedent —
  same platform, for infrastructure consistency and near-$0 cost.

## Assumptions
- **Only the schedule-reading calls need impersonation.** `listSchedules()` and
  `fetchCurrentOnCall()` (the two calls hitting the `403 Opsgenie` error) move behind the
  remote and run as an impersonated user. `fetchOpenAssignedTickets`, `postHandoffComment`,
  and `reassignIssue` keep running as `asApp()` from the existing Forge function, unchanged —
  they already work. This means the scheduled trigger itself stays a Forge `function`, and
  only makes an outbound call to the new remote to get schedule data, rather than the whole
  trigger moving to be remote-invoked. (Alternative shape, if this turns out not to work
  cleanly: the whole `checkShiftBoundaries` function moves to be remote-invoked instead. Note
  this as a fallback, not the primary plan, since keeping the blast radius small is better if
  the split approach works.)
- **Impersonate one fixed identity: the owner's own account** (`isogun21@gmail.com`, the site
  admin who is actively setting this up), not whoever happens to be on-call. This sidesteps
  the community-reported "no OAuth token found... even after interaction" failure mode, which
  appears tied to impersonating users who haven't engaged with the app. The account id for
  impersonation needs to be captured somehow -- simplest: hardcode it as an app-level constant
  for now (single-tenant dev app, not yet distributed), revisit if/when this app is installed
  on other sites.
- **Hosting: Cloudflare Workers**, matching Sweep, for infrastructure consistency the studio
  already has working knowledge of. The remote is a small JSON-in/JSON-out HTTPS endpoint, not
  a full application -- Workers' request/response model fits this without needing Atlassian's
  Node.js reference server framework verbatim.
- The remote must: (1) validate the incoming Forge Invocation Token (JWT) is genuinely from
  Atlassian before doing anything, (2) call the `offlineUserAuthToken` GraphQL mutation at
  `https://api.atlassian.com/graphql` using the app system token (received via
  `auth.appSystemToken` on the endpoint) to get a token for the impersonated user, (3) use
  that user token to call the JSM Ops schedules/on-calls endpoints, (4) return the result as
  JSON to the calling Forge function.
- JWT validation against Atlassian's JWKS endpoint is a real, unverified detail -- the exact
  JWKS URL and validation library choice need confirming against current docs during build,
  not assumed from a summarized source.

## Files to change
- `products/atlassian/passdown/manifest.yml` -- add `remotes` (Cloudflare Worker base URL),
  a new `endpoint` module (`remote:` + `route.path` + `auth.appSystemToken.enabled: true`),
  convert `permissions.scopes` from a list to a map, add `allowImpersonation: true` to
  `read:ops-config:jira-service-management` specifically (not the other scopes, which don't
  need it).
- `products/atlassian/passdown/src/scheduledTriggers/index.js` -- `listSchedules` and
  `fetchCurrentOnCall` change from direct `api.asApp().requestJira(...)` calls to an
  `invokeRemote` call against the new endpoint; everything downstream of getting the schedule
  data back is unchanged.
- NEW `products/atlassian/passdown/remote/` -- a small, separate Cloudflare Worker project
  (own `wrangler.json`/`wrangler.toml`, own `package.json`) implementing the JWT-validate ->
  impersonate -> call-Ops-API -> return-JSON flow. Kept as its own deployable unit, same
  pattern as Sweep being its own Worker, not folded into the Forge app's own bundle (Forge
  functions and Cloudflare Workers are different runtimes and deploy targets).
- `products/atlassian/passdown/CLAUDE.md` -- once this works, record the real, verified
  manifest shape and impersonation flow (superseding the "still needs confirming" language in
  the assumptions above), same discipline as every other resolved unknown in this project.

## What this builds
A narrow bridge: the existing scheduled trigger keeps almost all of its current logic, but for
the two calls that need Ops API access, it calls out to a small Cloudflare Worker instead of
calling Jira directly. That Worker's only job is: prove the request really came from Forge,
exchange the app's system token for a token belonging to the owner's own account, and use that
token to fetch schedule/on-call data on the app's behalf -- then hand the result straight back.
Nothing about the ticket-processing side (finding open tickets, generating the detailed
handoff brief, posting the comment, reassigning) changes at all.

## Security
- **New egress**: the Forge app now calls out to a Cloudflare Worker (declared in
  `remotes`), and that Worker calls `api.atlassian.com/graphql`. This is the exact tradeoff
  recorded in `CLAUDE.md` on 2026-08-03 -- explicit, owner-approved, and it costs "Runs on
  Atlassian" eligibility for this app going forward. Not a new decision, just where it's
  implemented.
- **New scope property**: `allowImpersonation: true` on `read:ops-config:jira-service-
  management` only. This is a real widening -- it lets the app act as a specific real user for
  that scope's calls, not just as itself. Scoped as narrowly as the impersonation mechanism
  allows (one fixed user, one scope).
- The Cloudflare Worker holds no long-lived secrets beyond what Forge's own JWT/token flow
  requires in-flight -- it should not persist the impersonated user's token or the app system
  token anywhere; each request re-validates and re-exchanges. Confirm this is the actual
  behavior in the implementation, not just the intent.
- Logs on both the Forge side and the Worker side stay operational-facts-only (schedule id,
  success/failure), consistent with the rest of this app -- no token values, no ticket
  content, ever logged.

## Done when
- `forge lint` passes.
- The Cloudflare Worker deploys successfully and responds to a manually-sent test request
  with a validated JWT (or a clear rejection of an invalid one, to confirm validation isn't a
  no-op).
- `forge deploy` + `forge install --upgrade` succeed with the new manifest shape.
- A real poll (within 5 minutes of the trigger firing) successfully lists schedules and reads
  current on-calls without the 403 -- confirmed via `forge logs`, not just "no error thrown."
- With that working, re-running the same shift-boundary override test from before (switching
  on-call between the two test accounts) produces the same successful handoff (comment +
  mention + reassignment) that we were blocked on previously.

## Checks
- `forge lint`
- Cloudflare Worker's own build/deploy check (`wrangler deploy` or equivalent, exact command
  confirmed once the Worker project is scaffolded)
- `forge deploy -e development --non-interactive`
- `forge install --upgrade -e development -p Jira -s isogun21.atlassian.net --confirm-scopes --non-interactive`
- `forge logs -e development` to confirm real success, not just absence of the old error

## Verification
1. I'll confirm the Worker responds correctly to a direct test call before wiring it into the
   Forge trigger, so we're not debugging both layers at once.
2. After deploy + install, wait for a poll cycle and check `forge logs` for successful
   schedule reads (no more 403).
3. Re-run the on-call override test (switch on-call between your two test accounts on the
   dev site) exactly as before, and confirm the same end-to-end result: a detailed handoff
   comment posted with the incoming person mentioned, and the ticket reassigned.
4. Report back with logs and a screenshot of the resulting comment, same as the per-ticket
   feature's verification.

## Not in this prompt
Impersonating arbitrary on-call users (as opposed to the one fixed owner identity), the
Slack/Teams toggle, and anything related to listing/submission remain out of scope here.
