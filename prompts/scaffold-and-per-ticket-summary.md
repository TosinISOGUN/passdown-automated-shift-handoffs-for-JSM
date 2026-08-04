# Scaffold Passdown and ship the per-ticket summary

## Goal
A working Forge app exists at `products/atlassian/passdown`, installed on the dev site, with
one real feature end to end: viewing a ticket shows a button that generates a plain-language
summary of that ticket's history via the Forge LLMs API. This is the smaller of Passdown's two
features and the proven half of the pattern (same engine shape as Recap) — it gives us a
working app to build the flagship shift-handoff feature on top of next, instead of trying to
land scheduling, on-call reads, and generation all at once.

## Context read
- `products/atlassian/passdown/CLAUDE.md` and `AGENTS.md` (this app's spec, including the
  2026-08-02 resolution of the three technical unknowns)
- `SKILLS.md` (studio workflow)
- The shared Atlassian `AGENTS.md` at `products/atlassian/recap/AGENTS.md` (Forge CLI
  conventions, UI Kit component list — reused unchanged per `passdown/CLAUDE.md`)
- `products/atlassian/recap/manifest.yml` and `products/atlassian/recap/src/resolvers/index.js`
  as the proven reference for wiring the `llm` module and calling `@forge/llm`'s `chat()` —
  adapted to a single-ticket scope, not copied verbatim (Recap fetches 30 days of issues
  cross-project; Passdown reads one ticket's own history)

## Assumptions
- `products/atlassian/passdown/` currently contains only `CLAUDE.md`, `AGENTS.md`, and this
  new `prompts/` folder — no Forge scaffold yet. Since the shared AGENTS.md's "stop and warn
  if the directory already exists" rule is meant to prevent overwriting a real app, and this
  directory holds only project docs, the safe path is: run `forge create -t
  jira-issue-panel-ui-kit passdown-scaffold-tmp` in `products/atlassian/`, then move the
  generated `manifest.yml`, `package.json`, `.gitignore`, `.eslintrc`, and `src/` into
  `products/atlassian/passdown/` (not overwriting `CLAUDE.md`/`AGENTS.md`/`prompts/`), then
  remove the temp directory. Flagging this because it's a workaround, not a documented Forge
  CLI behavior — if `forge create` errors or behaves unexpectedly, stop and report rather than
  forcing it.
- Dev site is `isogun21.atlassian.net`, same as Recap and Field Hygiene (not yet confirmed for
  this specific app — first `forge install` will surface if that's wrong).
- The "single ticket's own history" fetch means comments + status history + core fields for
  one issue key, via `GET /rest/api/3/issue/{issueIdOrKey}` (with `expand=changelog`) and
  `GET /rest/api/3/issue/{issueIdOrKey}/comment` — exact fields to be confirmed against docs
  during build, not assumed from Recap's JQL-search shape (different endpoint entirely).

## Files to change
- NEW `products/atlassian/passdown/manifest.yml`
- NEW `products/atlassian/passdown/package.json` (+ lockfile)
- NEW `products/atlassian/passdown/.eslintrc`, `.gitignore`
- NEW `products/atlassian/passdown/src/frontend/index.jsx` — issue panel UI: button, loading
  state, summary result, empty state (no comments/history yet), error state
- NEW `products/atlassian/passdown/src/resolvers/index.js` — `summarizeTicket` resolver:
  fetch one ticket's fields/comments/changelog, sanitize untrusted text (same control-char
  strip + length cap + data-fence pattern as Recap, since ticket comments are equally
  untrusted input to an LLM prompt), call `@forge/llm` `chat()`, deterministic fallback on
  LLM failure
- NEW `products/atlassian/passdown/src/index.js` (template default export, per scaffold)

## What this builds
- `jira:issuePanel` module, rendered natively, resolver-backed — the on-demand summary
  surface `CLAUDE.md` describes.
- `llm` module (`model: claude`), `function` module for the resolver — same shape as Recap's
  manifest, adapted to `jira:issuePanel` instead of `jira:globalPage`.
- Resolver reads the current ticket's summary, description, status, comments (author +
  body + timestamp), and status-change history via the Jira Cloud platform REST API
  (`asUser()`, per the shared AGENTS.md's stated preference — a real person is viewing the
  panel, so there's a user in session, unlike the scheduled-trigger case).
- System prompt instructs the model: honest account of what happened/what's blocking/what's
  next, no invented details, no marketing voice, untrusted ticket content wrapped in a data
  fence exactly as Recap does — same injection mitigation, same reasoning (Q9 of the security
  questionnaire).
- Deterministic template fallback if the LLM call fails, so the button never dead-ends —
  mirrors Recap's `templateReport` pattern.
- No storage of any kind. No egress beyond the Jira REST API and Forge's own LLM call.

## Security
- Scopes: `read:jira-work` (reading issue fields/comments/changelog — same scope Recap
  already uses for issue reads; confirm it covers changelog access, add nothing broader if
  not needed).
- `asUser()` for the ticket-history reads — matches shared AGENTS.md's stated preference over
  `asApp()` when a real user is in session.
- No new egress. No data leaves Atlassian's infrastructure; the LLM call is Forge's own
  hosted API, same as Recap.
- Logs: operational facts only (ticket key, success/failure, token-ish counts if useful) —
  never full comment text or the generated summary, per `passdown/CLAUDE.md`'s security rules.

## Done when
- `forge lint` passes with no errors.
- App installs clean on `isogun21.atlassian.net` (or whatever dev site `forge whoami`/install
  surfaces as correct).
- Opening a real ticket with actual comments and status changes, clicking the summary button,
  produces a plain-language paragraph that accurately reflects that ticket's history — no
  invented facts, no marketing tone.
- A ticket with no comments/history yet shows an honest empty state, not an error or a
  fabricated summary.
- Killing the LLM call (or hitting a real failure) still returns the deterministic fallback
  text rather than a dead button.

## Checks
- `forge lint`
- `forge deploy -e development`
- `forge install -e development -p Jira -s <dev-site> --confirm-scopes --non-interactive`

## Verification
1. Open a real ticket on the dev site that has at least a few comments and one status change.
2. Find the Passdown panel/section on the issue view, click the summarize action.
3. Confirm the summary reads as an honest, plain-language account of that specific ticket —
   check it against the ticket's actual comments, not just that text appeared.
4. Open a brand-new ticket with no comments and confirm the empty state reads sensibly rather
   than erroring or inventing a summary.
5. Report back with a screenshot of both states (populated ticket + empty ticket).

## Not in this prompt
The flagship shift-handoff feature (scheduled trigger, on-call schedule read, comment +
assignment posting) is deliberately deferred to its own prompt once this shared engine is
proven working end to end. Slack/Teams toggle, pricing/licensing wiring, listing assets, and
the marketing site are all separately scoped, later work per `CLAUDE.md`.
