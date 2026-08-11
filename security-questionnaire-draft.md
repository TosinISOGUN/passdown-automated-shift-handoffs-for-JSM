# Security questionnaire — draft answers

Reference doc for filling out the real forms in the Partner Portal, following the same pattern
as Field Hygiene's `security-questionnaire-draft.md`. Not the official form itself — Atlassian's
actual UI may phrase questions slightly differently; use this as the source of truth for what to
type, checked against the app's real, deployed architecture as of 2026-08-07.

**Passdown's answers differ meaningfully from Recap's and Field Hygiene's** in one specific way:
this app is not zero-egress. Read the egress section carefully before transcribing — it's the one
place where copy-pasting a prior app's answer would be wrong, not just slightly different.

---

## Privacy & Security tab

**Does your app store End-User Data outside of Atlassian products?** **Partially — yes, in a
narrow, disclosed way.** Two separate things are happening:
1. `@forge/kvs` storage (Atlassian-hosted Forge storage, not "outside") holds one record per
   on-call schedule: the current on-call participant's type and account ID, used only to detect
   when a shift boundary occurs. Not outside Atlassian's infrastructure.
2. A small, purpose-built Cloudflare Worker (`passdown-schedule-remote`) sits in the path of
   exactly one read: fetching the JSM on-call schedule. It exists only because Atlassian's own
   JSM Ops API is scoped to logged-in users, not apps acting on their own — a Forge scheduled
   trigger has no user in session, and Atlassian's own developer-relations team confirmed
   directly on our filed platform report that user impersonation via this pattern is the only
   sanctioned workaround. **The Worker stores or logs nothing.** It is a stateless per-request
   proxy: it receives a token-exchange request, forwards one API call, returns the response, and
   retains no state between requests. See `remote/src/index.js` — no database, no cache, no log
   line containing a token or account ID.

**Does your app process End-User Data outside of Atlassian products?** Yes, transiently, for the
one schedule-read path above — the Worker processes (never stores) the impersonated bearer token
and the schedule/on-call API response in memory for the duration of a single request. Ticket
content, comment text, and the generated handoff briefs never touch the Worker — that traffic
goes directly from the Forge function to Jira via `@forge/api`, same zero-egress path as every
other app from this studio. The Worker's involvement is scoped exclusively to reading *who is
on-call*, not to any ticket data.

**What data does the app store, and where?** In `@forge/kvs`: one record per on-call schedule,
key `schedule:<scheduleId>:on-call`, value `{ type: 'user' | 'team' | 'escalation', id }` —
the current on-call participant. Overwritten on every check, never appended to, so this does not
grow over time. No ticket content, no comment text, no generated brief text is ever stored.

**Remote REST API exposure (webtrigger)?** None. No `webtrigger` module in production —
Passdown uses a Forge `remote` (outbound, app-initiated) for the one schedule-read path
described above, not an inbound webtrigger. There is no way for an external caller to reach
Passdown's code.

**Does the app access Atlassian PATs, user passwords, or similar credentials?** No — not in the
usual sense. Forge itself issues the credentials involved: the app's own system token (delivered
via the `x-forge-oauth-system` header, per `auth.appSystemToken.enabled: true`) is exchanged, via
Atlassian's own GraphQL Gateway mutation (`offlineUserAuthToken`), for a token impersonating one
fixed, install-time-configured account, solely to read the on-call schedule that account's
permissions already cover. App code never sees, stores, or logs a password, PAT, or long-lived
credential at any point.

**Scope justification** (one line per scope):
- `read:jira-work` — read ticket data (comments, status history, fields) to generate the
  shift-handoff brief and on-demand summary.
- `write:jira-work` — post the handoff brief as a native comment, mention the incoming person,
  and reassign the ticket.
- `read:ops-config:jira-service-management` (with `allowImpersonation: true`) — read the native
  on-call schedule to detect shift boundaries; `allowImpersonation` is required specifically
  because this API surface is user-scoped, not app-scoped, per Atlassian's own confirmation.
- `storage:app` — persist the current on-call participant per schedule (see above), the only
  state Passdown needs to detect a boundary between one check and the next.

**Sub-processors / third-party sharing?** One: **Cloudflare**, hosting the stateless schedule-read
relay described above. No other third-party service of any kind is integrated. No data is shared
with Cloudflare beyond the transient, unstored request/response traffic of that one API call.

**Is end-user information logged, and is any log shared externally?** Forge-side logs (`forge
logs`) carry operational facts only — status codes, error messages, a schedule ID, never comment
text, ticket content, or the generated brief. The Cloudflare Worker's own logs (visible only to
Isogun Labs via `wrangler tail`, not shared externally) contain request-level metadata (path,
status) and explicitly never log the bearer token or account ID — confirmed by reading
`remote/src/index.js`: `console.error` calls log only `err.message`, never token or identity
values.

**Data retention after uninstall?** Standard Forge behavior for the KVS-stored on-call record —
uninstalling removes it. The Cloudflare Worker retains nothing to begin with, so there is nothing
to delete there.

**Data residency support?** Inherited from Forge for the KVS-stored data. The one exception:
the schedule-read relay call transits Cloudflare's network as a stateless proxy — this is
disclosed here rather than implied away, since it's a genuine (if momentary and non-storing)
departure from staying entirely within Atlassian's residency boundary for that one API call.

**Full disk encryption at rest (for data stored outside Atlassian)?** N/A for the Worker — it
stores nothing, so there is no data at rest to encrypt there.

**GDPR controller/processor status, CCPA status, DPA availability?** Isogun Labs does not act as
a GDPR controller or processor for Passdown. The only persisted data (the KVS on-call record) is
an account reference used solely to detect a schedule change, not to profile or characterize a
person's behavior; it is Forge-hosted, already covered by Atlassian's own Forge Data Processing
Addendum. The Cloudflare relay processes an account ID and a bearer token only transiently, in
memory, per request, and stores neither — the same reasoning that exempts a stateless network
proxy generally. No separate DPA needed from Isogun Labs.

**Compliance certifications (SOC2, ISO27001, HIPAA, FedRamp)?** None — solo/small vendor, no
certifications held. Honest no, same as every other app from this studio.

**Privacy policy URL / Security policy URL?** `https://passdown.isogunlabs.com/privacy.html` and
`https://passdown.isogunlabs.com/security.html` — live, and the Security page already discloses
the schedule-read remote in the same terms as this document, so the two can't drift apart.

**Security contact email?** `support@isogunlabs.com`.

**CAIQ Lite?** Not started — same call as Field Hygiene, revisit only if the form actually
requires it.

**Security Bug Bounty Program participation?** Auto-populated by Atlassian.

---

## Security Questionnaire for Forge Apps (technical)

**Authentication & Authorization**
- `asUser()` is used for the on-demand per-ticket summary (a real person is viewing the panel).
- `asApp()` is used for the scheduled trigger's own Jira REST calls (posting comments, mentions,
  reassignment) — the same justified exception every prior app has used, since a scheduled
  trigger has no user in session. Confirmed against current Forge docs, not assumed.
- The schedule-read path is neither `asUser()` nor `asApp()` — it's a third, distinct mechanism
  (offline user impersonation via a Forge remote), used because Atlassian's own JSM Ops API is
  scoped to logged-in users only and confirmed unsupported for `asApp()` by an Atlassian
  developer-relations engineer on our own filed platform report. This is disclosed explicitly
  rather than folded into the `asApp()` answer, since it's architecturally different.
- No permission-escalation logic. Scopes are fixed at install/upgrade time via the manifest,
  approved explicitly by the installing admin. The impersonated account is fixed at install time
  by the admin, not selectable or escalatable by app logic at runtime.

**Data Security**
- One disclosed egress path: the Cloudflare-hosted schedule-read relay, described in full above.
  Everything else — ticket reads, comment/mention/reassignment writes, LLM summarization — stays
  inside Atlassian's Forge platform boundary.
- Storage is limited to the single current-on-call-participant record per schedule described
  above; encryption at rest is Atlassian/Forge-managed for that data.
- No PII beyond an account ID (already visible to any user who can see the schedule) is ever
  transmitted or stored; no ticket content or generated brief text leaves Atlassian's platform.

**Application Security**
- All Jira REST calls use `@forge/api`'s `route` tagged template — no hand-built query strings,
  no injection surface.
- Comment bodies and issue text are untrusted, free-text input that ends up in the LLM prompt.
  `sanitizeText()` in `src/lib/summarize.js` strips control characters, caps length at 500
  characters per field, and the summarization prompt fences this data explicitly as data, never
  as instructions — the same mitigation Recap uses for the same class of input.
- The Cloudflare Worker independently verifies every incoming request's Forge Invocation Token
  (a signed JWT, checked against Atlassian's own published JWKS, audience-scoped to this app's
  ARI) before doing anything else — rejecting any request that doesn't genuinely originate from
  Forge, which is the control that keeps the relay from being an open door.
- Dependencies: first-party Atlassian packages (`@forge/api`, `@forge/kvs`, `@forge/llm`,
  `@forge/react`, `@forge/resolver`) plus `react` as `@forge/react`'s required peer, and on the
  Worker side, `jose` (JWT verification) — a widely-used, actively maintained library, not an
  ad-hoc dependency.
- **`npm audit` run 2026-08-07, both the app and the remote.** App: 13 advisories (2 moderate,
  11 high), all Regular-Expression-Denial-of-Service class — availability risk under adversarial
  input, not remote code execution or data exposure. Traced with `npm ls` to two sources: (a)
  `eslint`, a devDependency, lint-only tooling never bundled into the deployed Forge function,
  and (b) Atlassian's own `@forge/api`/`@forge/bridge`/`@forge/kvs` dependency chains
  (`@forge/manifest`→`glob`→`minimatch`, `@atlaskit/adf-schema`→`prosemirror-markdown`→
  `markdown-it`, `@forge/manifest`→`cheerio`→`undici`) — Atlassian's own SDK chain, not something
  this app chose or can patch independently. Remote: 3 advisories (2 moderate, 1 high), same
  `undici` ReDoS class, traced to `wrangler`/`miniflare` — Cloudflare's own deploy tooling, a
  devDependency never bundled into the deployed Worker's runtime code (`src/index.js` has zero
  runtime dependencies beyond `jose`). Net position for both: no direct-dependency
  vulnerabilities; all transitive ones sit in Atlassian's or Cloudflare's own tooling/SDK chains
  and will resolve as those vendors ship updates, not through action on this app's side.

**Secrets Management**
- No secrets, API keys, or long-lived credentials are stored in the app or the Worker. Forge owns
  the app's own authentication; the Worker exchanges a short-lived system token for a short-lived
  impersonated token per request and persists neither.
- The Worker's Cloudflare-side configuration (the impersonated account ID) is stored as Worker
  environment configuration, not in source code or a public repository.
- Vulnerability/incident reports go to `support@isogunlabs.com`, read directly by the vendor — a
  solo/small studio, not a dedicated security team, stated plainly rather than implying a formal
  process that doesn't exist.

---

## Still needed before this can actually be submitted

1. ~~Run `npm audit` against the current dependency tree~~ **Done 2026-08-07** — see the
   Application Security section above.
2. Confirm the security contact (`support@isogunlabs.com`) has an active ecosystem.atlassian.net
   account, same requirement Field Hygiene's questionnaire surfaced.
3. Re-read this draft against `security.html` once more immediately before submission, to make
   sure nothing drifted since either was last touched.
