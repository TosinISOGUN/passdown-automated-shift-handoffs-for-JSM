# Passdown — Automated Shift Handoffs for JSM

A Forge app for Jira Service Management. When a shift ends, Passdown reads what actually
happened, writes a plain-language handoff brief, posts it where the incoming person will see
it, and tags them — no one has to remember to write anything down. The same engine also
summarizes any single ticket on demand, in plain English, for anyone who needs to catch up
fast without reading the full comment history.

Built by [Isogun Labs](https://isogunlabs.com/). Fourth app from the studio.

![Status](https://img.shields.io/badge/status-in%20development-B45309)
![Platform](https://img.shields.io/badge/platform-Atlassian%20Forge-0052CC)
![Runs on Atlassian](https://img.shields.io/badge/Runs%20on%20Atlassian-no-B91C1C)
![Version](https://img.shields.io/badge/version-4.2.0-0D9488)

**Status:** in active development, ahead of Atlassian Marketplace submission. Not yet
installable by anyone outside the developer's own site.

---

## What it does

1. **Automated shift-handoff brief (flagship).** A scheduled check reads Jira Service
   Management's native on-call schedule. When the on-call person for a schedule changes,
   Passdown finds every ticket still open and assigned to the outgoing person, writes a
   plain-language brief for each (what happened, what's blocking, what's next), posts it as a
   comment with the incoming person @-mentioned, and reassigns the ticket to them — the
   reassignment is the primary, guaranteed notification signal, since an app-authored mention
   isn't confirmed to reliably trigger Jira's own notification pipeline.
2. **On-demand per-ticket summary.** The same generation engine, available as a panel on any
   individual ticket, for anyone who needs to catch up on that ticket's history without
   waiting for a shift boundary.

Neither feature invents details not present in the ticket's own history, and neither builds or
duplicates any rotation/scheduling/delegation logic — Passdown only reads the on-call schedule
an existing JSM setup already maintains.

## Why it doesn't carry the "Runs on Atlassian" badge

Reading JSM's on-call schedule via a Forge app's own system identity (`asApp()`) fails on the
relevant JSM Ops API with a `403` — a confirmed platform limitation, not a bug here (JSM Ops
API permissions are strictly user-oriented; Atlassian's own community confirmed there's no
supported workaround). The only working fix is a small hosted component (a Cloudflare Worker,
in `remote/`) that exchanges Passdown's system token for a token impersonating one designated
user, then reads the schedule directly. That's real, disclosed external egress, which is what
removes "Runs on Atlassian" eligibility for the base install — not just for an optional
add-on. Full detail: [passdown.isogunlabs.com/security.html](https://passdown.isogunlabs.com/security.html).

## How it's built

- **`@forge/react`** (UI Kit native) — the on-demand summary panel (`jira:issuePanel`).
- **`@forge/resolver`** — the on-demand panel's backend.
- **`@forge/api`** (`requestJira`) — Jira reads/writes: `asUser()` for the on-demand panel,
  `asApp()` for the scheduled trigger's ticket search/comment/reassignment calls.
- **`@forge/llm`** — Atlassian-hosted Forge LLMs API generates both the on-demand summary and
  the shift-handoff brief text (two prompt styles, shared engine).
- **`@forge/kvs`** — one bounded record per on-call schedule (`storage:app`), holding only the
  current on-call participant id, overwritten every check. Never a growing history.
- **A Cloudflare Worker** (`remote/`) — the one piece that runs outside Forge's own sandbox,
  used solely to read the on-call schedule via user impersonation (see above).

### Layout

| Path | What's there |
| --- | --- |
| `manifest.yml` | `jira:issuePanel`, two `function` modules, a `scheduledTrigger` (5-minute interval), the `llm` module, the `passdown-sched-remote` remote entry, and scopes |
| `src/resolvers/index.js` | On-demand summary resolver |
| `src/scheduledTriggers/index.js` | Shift-boundary detection, ticket lookup, comment + mention + reassignment |
| `src/lib/summarize.js` | Shared generation engine (fact-gathering, prompt building, both `'brief'` and `'handoff'` styles, deterministic fallback) |
| `remote/` | Cloudflare Worker — validates the Forge Invocation Token, exchanges it for an impersonated user token, reads the on-call schedule from `api.atlassian.com` directly |
| `branding/`, `static/` | App icon source and deployed copy |
| `prompts/` | Every implementation prompt this app was built from, in order |

The public marketing/docs/privacy/security site (`passdown.isogunlabs.com`) is a **separate
repo** ([`passdown-privacy`](https://github.com/TosinISOGUN/passdown-privacy)), not tracked
inside this one — see `.gitignore`.

## Commands

The Forge CLI may not be on PATH in a fresh shell. In Git Bash, prepend your global npm bin
(e.g. `export PATH="$PATH:/c/Users/<you>/AppData/Roaming/npm"`).

| Task | Command |
| --- | --- |
| Lint | `forge lint` |
| Deploy (dev) | `forge deploy -e development --non-interactive` |
| Install (first time) | `forge install -e development -p Jira -s your-site.atlassian.net --confirm-scopes --non-interactive` |
| Upgrade after new scopes/modules | `forge install --upgrade -e development -p Jira -s your-site.atlassian.net --confirm-scopes --non-interactive` |
| Tunnel (live reload) | `forge tunnel` |
| Logs | `forge logs -e development` |
| Deploy the schedule remote (only when `remote/` changes) | `cd remote && npx wrangler deploy` |

## Scopes requested

| Scope | Why |
| --- | --- |
| `read:jira-work` | Read ticket content needed to generate a summary |
| `write:jira-work` | Post the handoff comment and reassign the ticket |
| `read:ops-config:jira-service-management` (impersonation allowed) | Read who is currently on-call, for the scheduled boundary check only |
| `storage:app` | One bounded record per on-call schedule |

## Scope discipline

No rotation, scheduling, or delegation logic of any kind — Passdown reads the existing on-call
schedule and never builds a competing one. No open-ended third-party integration baked into
the core; Slack/Teams push is planned as a future, explicit, admin-only opt-in (see Roadmap),
not part of this build. No growing analytics or trend history — storage is bounded by design.

## Roadmap

- **Slack/Teams push** — planned, explicitly deferred to a post-launch release (2026-08-04).
  Off by default when it ships; enabling it will independently cost the specific installation
  "Runs on Atlassian" eligibility, separate from the base app's current egress.
- Atlassian Marketplace submission, once the marketing site, pricing/licensing wiring, and
  listing assets are complete.

## Pricing

Free for small teams (≤10 users on the installation), paid per seat above that threshold —
mirrors the visibility-first pricing approach used across Isogun Labs' early-stage apps.

## Privacy & support

- **Site, documentation, privacy, and security policy:** https://passdown.isogunlabs.com/
- **Support:** support@isogunlabs.com

## Changelog

### 4.2.0 — in development
- Forge app scaffold, on-demand per-ticket summary panel (`jira:issuePanel`).
- Automated shift-handoff brief: scheduled trigger, on-call schedule boundary detection,
  per-ticket brief generation, comment + mention + reassignment.
- Diagnosed and worked around a confirmed Atlassian platform bug: `asApp()` calls to the JSM
  Ops API fail with a 403; fixed via a Cloudflare Worker remote using offline user
  impersonation — see `remote/` and the Security page for the full story.
- Real app icon shipped (continuity/handoff concept).
- Marketing/docs/privacy/security site built and published at `passdown.isogunlabs.com`.

---

*An independent app by Isogun Labs. Not affiliated with or endorsed by Atlassian.*
