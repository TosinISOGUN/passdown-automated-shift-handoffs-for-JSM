# passdown.isogunlabs.com marketing site

## Goal
A live, published static site at `passdown.isogunlabs.com` with Home, Documentation,
Security, and Privacy pages — required for Marketplace submission, following the same
pattern already proven for `recap.isogunlabs.com` and `field-hygiene`'s site.

## Context read
- `products/atlassian/passdown/CLAUDE.md` — "Website" section (required pages, same-repo
  pattern as Recap, own repo/gitignored from this project), the RoA-badge loss (2026-08-03,
  must be stated plainly on the site, not glossed over), the Slack/Teams toggle deferral
  (2026-08-04, so the site describes it as "coming later," not as a shipped feature)
- `products/atlassian/recap/site/index.html`, `docs.html`, `privacy.html`, `security.html` —
  the structural, meta-tag, and nav pattern being reused
- `products/atlassian/passdown/src/scheduledTriggers/index.js` and
  `products/atlassian/passdown/manifest.yml` — actual data flow and scopes, so
  Security/Privacy copy describes what the app really does, not a generic template
- `products/atlassian/passdown/branding/` — existing logo assets
  (`passdown-logo-144.png`, `passdown-logo-512.png`, `passdown_logo.png`)

## Assumptions
- Same repo-independence pattern as Recap: `site/` becomes its own git repo (own `.gitignore`,
  own `CNAME`), gitignored from the parent `passdown` project directory rather than committed
  into it. Deployment host (GitHub Pages, same as Recap/Field Hygiene, presumed from the
  `CNAME` file pattern) is unverified — ASK before actually pointing DNS or creating the
  remote repo/pages config; this prompt only covers authoring the site files.
- Copy states plainly, on the Security page, that Passdown does **not** qualify for the "Runs
  on Atlassian" badge, and why (the JSM Ops API remote+impersonation workaround) — this is a
  real, user-facing difference from Recap and Field Hygiene's sites and must not be silently
  omitted or glossed as a generic disclaimer.
- Documentation page covers both shipped behaviors (automated shift-handoff brief, on-demand
  per-ticket summary) and explicitly marks Slack/Teams push as "planned, not yet available,"
  not omitted and not described as current.
- No new brand identity work — reuse the existing `passdown_logo.png` concept and Recap's
  established color/typography system as the base, adjusted only where Passdown's own accent
  (from the app icon) diverges.

## Files to change (all NEW)
- `products/atlassian/passdown/site/index.html`
- `products/atlassian/passdown/site/docs.html`
- `products/atlassian/passdown/site/privacy.html`
- `products/atlassian/passdown/site/security.html`
- `products/atlassian/passdown/site/robots.txt`
- `products/atlassian/passdown/site/sitemap.xml`
- `products/atlassian/passdown/site/CNAME` (content: `passdown.isogunlabs.com`)
- `products/atlassian/passdown/site/.gitignore` (mirrors Recap's site-level gitignore)
- `products/atlassian/passdown/site/assets/css/site.css`
- `products/atlassian/passdown/site/assets/img/` — copies of the existing branding PNGs sized
  for web use (144px, 512px, favicon), plus one og:image-sized thumbnail (1280x720, new
  composition, not just a resized icon)

## What this builds
1. **Home (`index.html`)** — pitch: the shift-handoff brief as the flagship feature, the
   on-demand per-ticket summary as secondary. Real screenshots are not required for this
   prompt (listing assets are separately scoped later); use the existing UI or a clearly
   labeled mockup placeholder if no screenshot exists yet — ASK if unclear which to use.
2. **Documentation (`docs.html`)** — how the shift-handoff brief works (reads the on-call
   schedule, fires at boundaries, posts + mentions + reassigns), how the on-demand summary
   works, and a clearly marked "Coming later: Slack/Teams push" section — not hidden, not
   overstated as available now.
3. **Security (`security.html`)** — mirrors the Privacy & Security tab content that will be
   submitted with the app (same discipline as Recap: written together, not independently).
   Must cover: OAuth-only auth, scopes actually requested (`read:jira-work`,
   `write:jira-work`, `read:ops-config:jira-service-management`, `storage:app`), the bounded
   KVS storage (one entry per on-call schedule, overwritten each poll, never grows), the
   remote/egress path (Cloudflare Worker + user-impersonation for the JSM Ops API workaround)
   stated as real egress, and the explicit "does not qualify for Runs on Atlassian" statement
   with the reason.
4. **Privacy (`privacy.html`)** — what ticket/schedule data Passdown reads, what it does and
   does not store, referenced from the in-app submission flow later.
5. Nav, footer, and meta tags (canonical, OG, Twitter card, JSON-LD breadcrumb) follow the
   same structure as Recap's pages, re-themed with Passdown's own copy, logo, and page titles
   — not copy-pasted Recap content.

## Security
- No app code changes — this is a static marketing site with no Forge module, no scopes, no
  data collection of its own (no forms, no analytics script beyond what's already used
  studio-wide, if anything — ASK if analytics inclusion is wanted here).
- Site content must accurately reflect the real app's scopes/storage/egress as of
  2026-08-04, not a generic template — see "What this builds" #3.

## Done when
- All six pages render correctly opened locally (file:// or a simple static server), nav
  links work between them, and mobile layout doesn't break (reuse Recap's responsive CSS
  patterns).
- Security page explicitly and correctly states the RoA-badge loss and its cause.
- Documentation page clearly separates "available now" from "planned" (Slack/Teams).
- No broken image references, no leftover Recap copy/branding anywhere in the output.

## Checks
- Open each HTML file in a browser and visually confirm no layout breakage, correct title
  tags, and working nav.
- Validate all internal links resolve (no 404s to nonexistent anchors/pages).

## Verification
1. Open `products/atlassian/passdown/site/index.html` directly in a browser; click through
   to Documentation, Security, and Privacy via the nav.
2. Confirm the Security page's RoA statement reads correctly and matches the CLAUDE.md
   reasoning.
3. Confirm the Documentation page's Slack/Teams section reads as "not yet available," not as
   a shipped feature.
4. Report back on what's still needed before this can actually go live (repo creation, DNS,
   Pages/hosting config) — those steps are a separate ASK, not covered by this prompt.

## Not in this prompt
Actual deployment (new repo, DNS/CNAME activation, hosting setup), real product screenshots
if none exist yet, and any analytics wiring.
