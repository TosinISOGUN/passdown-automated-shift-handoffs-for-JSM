# Pricing & licensing wiring

## Goal
An unlicensed Passdown installation (trial expired, no active subscription) is actually
blocked from both paid actions — the on-demand summary and the automated shift-handoff brief
— instead of running for free indefinitely. Licensed installations (including the free
≤10-user tier, once configured in the Partner Portal) are unaffected.

## Context read
- `products/atlassian/passdown/CLAUDE.md` — "Ask before drafting the first prompt" §3:
  pricing resolved 2026-08-02 as free ≤10 users, paid above, mirroring Recap.
- `products/atlassian/recap/src/resolvers/index.js` — Recap's existing license-gate pattern
  (`isUnlicensed(context)`, `context.license.active !== true`, treats `undefined` as
  "don't gate" since it's only populated in production for listed Marketplace apps).
- `products/atlassian/recap/manifest.yml` — `app.licensing.enabled: true`, the only manifest
  change Recap needed.
- `products/atlassian/passdown/src/resolvers/index.js`, `src/scheduledTriggers/index.js`,
  `src/frontend/index.jsx` — current on-demand resolver, scheduled trigger, and UI states.
- Current Forge docs fetched this session (developer.atlassian.com License API reference,
  Atlassian Community threads on scheduled-trigger license checks): confirmed
  `context.license` is populated for **resolver invocations** in production for listed apps
  (same as Recap's pattern), but is **not reliably available in scheduled-trigger context** —
  community reports confirm `context` itself can lack `.license` there. The documented,
  reliable way to check license status from **any** backend code, including a scheduled
  trigger, is the dedicated License REST API: `GET /forge/app/v1/license` via
  `requestAtlassian` from `@forge/api` (already a dependency, no new package). No OAuth scopes
  required. Rate-limited to 1 request per 5 minutes per installation, 10/minute per tenant.

## Assumptions
- **Both paid actions are gated, not just one.** Pricing is per-installation, not per-feature,
  so an unlicensed install loses both the on-demand summary and the automated handoff. This
  wasn't separately decided in CLAUDE.md but follows directly from the existing pricing
  decision — flagging it here rather than treating it as silently obvious.
- **On-demand resolver**: gate via `context.license`, exactly like Recap's `isUnlicensed()`
  helper — `undefined` (dev/staging/free-unlisted) does not gate, only an explicit
  `active !== true` does.
- **Scheduled trigger**: `context.license` is not trusted here. Instead, call the License
  REST API **once per `checkShiftBoundaries` invocation** (not once per on-call schedule
  inside the loop) — the 5-minute rate limit lines up exactly with the trigger's own
  `fiveMinute` interval, so one call per run stays inside the limit; one-per-schedule would
  not, once an install has more than one on-call schedule. If unlicensed, skip all schedule
  processing for that run and log it — do not `kvs.set` anything either, so nothing about
  on-call state silently drifts while unlicensed.
- If the License API call itself fails (network/transient error), **fail open** for this one
  run (process schedules as normal, log the failure) rather than silently disabling the
  flagship feature on a transient error — matches this app's existing soft-fail discipline
  (one ticket/schedule failing doesn't block others).

## Files to change
- `products/atlassian/passdown/manifest.yml` — add `app.licensing.enabled: true`.
- `products/atlassian/passdown/src/resolvers/index.js` — add the `context.license` gate to
  `summarizeTicket`, returning `{ unlicensed: true }` instead of throwing.
- `products/atlassian/passdown/src/frontend/index.jsx` — new `UNLICENSED` state, rendered as
  a `SectionMessage` ("A subscription is required") matching Recap's UX pattern, no crash.
- `products/atlassian/passdown/src/scheduledTriggers/index.js` — `checkShiftBoundaries` calls
  the License REST API once at the top of the function; if unlicensed, log and return before
  touching any schedule.

## What this builds
1. `licensing.enabled: true` in the manifest — required for the License API to return real
   data at all; without it every call reports as unlicensed.
2. On-demand path: `summarizeTicket` checks `context.license` the same way Recap's resolver
   does. Unlicensed → `{ unlicensed: true }`, no LLM call spent. The UI shows a clear
   "subscription required" message instead of erroring.
3. Scheduled path: `checkShiftBoundaries` calls `GET /forge/app/v1/license` via
   `requestAtlassian()` once per run. `license.active !== true` → log
   `"Passdown is unlicensed on this installation; skipping shift-boundary check."` and return
   immediately, before listing schedules or touching KVS. A failed API call itself does not
   block the run (fail open, per Assumptions).

## Security
- No new scopes — the License API needs none.
- No new runtime dependency — `requestAtlassian` ships in `@forge/api`, already used.
- Nothing about license state is logged beyond the one operational line above; no license
  payload details (dates, billing period) are logged.

## Done when
- `forge lint` passes.
- On the dev site (which has no real Marketplace listing, so `context.license` is `undefined`
  and the License API will report unlicensed once `licensing.enabled` flips on): confirm the
  on-demand panel shows the new "subscription required" state, and `forge logs` shows the
  scheduled trigger skipping cleanly rather than erroring.
- Existing behavior (summary generation, shift-boundary detection) is provably unchanged for
  the licensed case — this can't be verified live against a real paid install yet, so
  verification here is code review + the dev-site unlicensed-path check above, not an
  end-to-end licensed run.

## Checks
- `forge lint`
- `forge deploy -e development --non-interactive`
- `forge logs -e development` — watch the scheduled trigger's next run

## Verification
1. Open a ticket's Passdown panel on the dev site and click "Summarize this ticket" — since
   the dev site has no real license, expect the new "A subscription is required" message
   instead of a generated summary.
2. Check `forge logs -e development` after the next scheduled trigger run — expect the new
   "unlicensed, skipping" log line instead of a normal boundary check.
3. Report back whether this dev-only behavior (everything blocked) is acceptable for
   continued local testing, or whether a temporary way to bypass the gate in development is
   wanted — Recap's app didn't need one since `context.license` is simply `undefined` in dev
   and its gate treats that as "don't block," but Passdown's scheduled-trigger path calls the
   License API directly, which may report unlicensed in dev rather than `undefined`. This is
   worth confirming empirically once deployed, not assumed — flag it in the report rather than
   silently deciding either way.

## Not in this prompt
Actually configuring per-seat pricing tiers or the free-≤10-users threshold in the Atlassian
Partner Portal — that's a Marketplace listing-time step, not app code, and only becomes
possible once the app is far enough along to be submitted.
