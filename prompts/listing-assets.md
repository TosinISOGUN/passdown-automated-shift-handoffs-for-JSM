# Listing assets: screenshots, banner, listing copy

## Goal
Passdown has real listing copy, three Marketplace-ready Highlight screenshots, and a marketing
banner, following the exact pattern already proven on Field Hygiene and Recap — so the Partner
Portal listing form can be filled in without any placeholder content.

## Context read
- `products/atlassian/passdown/CLAUDE.md` — flagship feature, on-demand summary, egress
  disclosure, pricing (free ≤10 users, $1.50/user/month above, owner-approved 2026-08-07).
- `products/atlassian/field-hygiene/listing-copy-draft.md` and its `CLAUDE.md` "Definition of
  done" banner/screenshot entries — the established format and the rule that Highlight
  screenshots must show real Atlassian UI, not a marketing graphic (marketing treatment is for
  the banner only).
- `products/atlassian/passdown/site/assets/img/` — real captures already taken during the
  marketing-site build: `shot-handoff-ticket-1.png`, `-2.png`, `-3.png` (full Jira chrome,
  automated handoff comment with @-mention, on different tickets), `shot-oncall-schedule.png`
  (actually the on-demand summary result panel with the Regenerate button, despite the
  filename), `shot-summarize-button.png`, `shot-summarize-empty.png`.
- `products/atlassian/passdown/security-questionnaire-draft.md` — the egress disclosure wording
  already settled, reused verbatim in listing copy so nothing drifts between documents.

## Assumptions
- Marketplace Highlight screenshot spec is the same as Field Hygiene's (1840×900 primary,
  580×330 thumbnail, exactly 3 required) — reasonable since both are Forge/Jira apps on the
  same Partner Portal, but will double-check against the actual upload form before finalizing
  dimensions.
- The three highlights will be: (1) the automated shift-handoff brief posted as a real comment
  (`shot-handoff-ticket-1.png`), (2) the on-demand per-ticket summary result
  (`shot-oncall-schedule.png`), (3) the "Summarize this ticket" button alongside a posted
  handoff on the same ticket (`shot-handoff-ticket-2.png`), showing both features together as
  proof they're genuinely one panel, not two separate installs.
- Banner uses the same composited pattern as Field Hygiene's (badge pill, headline, bullets, a
  framed real-screenshot crop, floating status chip) in Passdown's own blue-to-teal identity —
  not a new design language.

## Files to change
- `products/atlassian/passdown/listing-copy-draft.md` — NEW
- `products/atlassian/passdown/assets/marketplace/highlight1-handoff-1840x900.png` /
  `-580x330.png` — NEW
- `products/atlassian/passdown/assets/marketplace/highlight2-summary-1840x900.png` /
  `-580x330.png` — NEW
- `products/atlassian/passdown/assets/marketplace/highlight3-both-1840x900.png` /
  `-580x330.png` — NEW
- `products/atlassian/passdown/assets/marketplace/banner-1120x548.png` /
  `-560x274.png` (+ `banner.svg` source) — NEW
- `products/atlassian/passdown/CLAUDE.md` — mark the listing-assets checklist item done, same
  as Field Hygiene's "Definition of done" entries.

## What this builds
1. **Listing copy** — app name (already decided), tagline, full description (flagship +
   on-demand summary, the honest egress disclosure in the same words as `security.html`,
   pricing line), short feature bullets, suggested categories/tags, support/legal fields — same
   structure as `field-hygiene/listing-copy-draft.md`.
2. **Three Highlight screenshots** — crop/resize the three real captures listed above to spec.
   No compositing, no added text — Atlassian's own guidance for Highlights is the real product
   UI, unmodified beyond cropping to the required aspect ratio.
3. **Banner** — one composited marketing graphic (not used for Highlights), built the same way
   as Field Hygiene's: a dark gradient panel in Passdown's blue-to-teal identity, badge pill,
   headline pulled from the site's own hero ("The shift handoff you didn't have to write"),
   3-4 bullets, a framed crop of `shot-handoff-ticket-1.png`, floating "Live in your Jira site"
   chip.

## Security
No code, scope, or manifest changes. Pure content/asset work — listing copy, image crops, and
a documentation update.

## Done when
- `listing-copy-draft.md` exists with every section field-hygiene's version has, filled in with
  Passdown-accurate content, owner-approved before anything goes into the Partner Portal.
- All three Highlight image pairs exist at the correct dimensions, sourced from real,
  unmodified (beyond cropping) app screenshots.
- Banner exists as both PNG sizes plus its SVG source, in Passdown's own brand identity.
- `CLAUDE.md`'s definition-of-done checklist reflects all of the above as done, matching how
  Field Hygiene's was updated.

## Checks
- Visual review of every generated image at its stated dimensions before calling this done —
  no broken crops, no illegible text at thumbnail size.
- Read the finished `listing-copy-draft.md` back against `CLAUDE.md` and
  `security-questionnaire-draft.md` for any contradiction (especially the egress disclosure).

## Verification
Owner reviews `listing-copy-draft.md` and the rendered images (paths given in the completion
report) before anything is pasted into the Partner Portal — same review step used for Field
Hygiene and Recap before their submissions.
