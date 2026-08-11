# Listing copy — draft

Reference doc for the Marketplace Partner Portal listing form, following the same pattern as
Field Hygiene's `listing-copy-draft.md`. Draft only — final copy should get a read-through
against the live app before submission, and category/tag names below should be checked against
whatever the Partner Portal's actual dropdown offers.

## App name

**Passdown — Automated Shift Handoffs for JSM**

Matches the name already decided and used everywhere else (manifest title, the marketing site,
this repo's name). Does not start with "Jira," uses "for JSM" as a descriptor.

## Tagline (short, one-line summary — shown in search results)

**The shift handoff you didn't have to write.**

Alternates, if the primary reads too long for the field's character limit:
- "No one has to remember to write the handoff."
- "Automated shift-handoff briefs for Jira Service Management."

## Full description

Every shift-based support team loses the first stretch of every shift reconstructing what the
previous person already knew. That knowledge lives in someone's head, a rushed message, or
nowhere. Existing apps solve *who's* on shift — rotation, delegation, on-call scheduling —
none solve *what happened during it*.

Passdown reads the on-call schedule you already maintain in Jira Service Management. The
moment it detects a shift boundary — the on-call person changing from one teammate to the
next — it looks at what the outgoing person's open tickets actually did during the shift,
writes a plain-language account of what happened, what's still blocking, and what's next, and
posts it as a native Jira comment. The incoming person is mentioned directly and the ticket is
reassigned to them — two independent, guaranteed signals, not one fragile notification you
have to hope fired correctly.

- **Automated shift-handoff briefs** — fires on its own at every shift boundary, no manual step
  from the outgoing agent.
- **On-demand ticket summaries** — the same plain-language engine, scoped to any single ticket,
  available any time someone needs to get caught up fast.
- **No invented details** — the brief describes what the ticket data actually says happened,
  never numbers or outcomes dressed up to sound more impressive.
- **Two independent notification signals** — a native comment with a direct mention, and a
  ticket reassignment, so the handoff is never silently missed.

**How it's built, honestly:** ticket summarization and brief-writing run entirely on Atlassian
Forge's hosted AI, inside Atlassian's platform boundary. Reading the native on-call schedule
requires one disclosed exception — a small, purpose-built relay, required because Atlassian's
own on-call API is scoped to logged-in users, not apps acting on their own, and confirmed as
the only sanctioned workaround directly with Atlassian's developer-relations team. The relay
stores and logs nothing; ticket content and generated briefs never touch it. Full detail on the
[Security page](https://passdown.isogunlabs.com/security.html).

Free for sites of 10 users or fewer. Paid per seat above that, same features at every tier.

## Feature bullets (short form)

- Automated shift-handoff briefs at every on-call boundary
- On-demand plain-language summary for any single ticket
- Posted as a native comment, incoming person mentioned and reassigned
- No invented details — describes what the ticket data actually says
- Zero configuration — install and it watches the schedule you already maintain
- Doesn't duplicate or compete with your on-call scheduling tool

## Suggested categories / tags

(Check against the actual Partner Portal taxonomy before submitting.)

- Primary category: **IT Service Management** or **Collaboration** (whichever the taxonomy
  offers closer to JSM-specific workflow tools)
- Tags/keywords: shift handoff, on-call, JSM, service management, AI summary, ticket summary,
  incident handoff

## Support / legal fields

- Support contact: `support@isogunlabs.com`
- Privacy policy: `https://passdown.isogunlabs.com/privacy.html` — live.
- Security policy: `https://passdown.isogunlabs.com/security.html` — live, includes the
  schedule-read relay disclosure in the same terms as `security-questionnaire-draft.md`.
- Vendor: Isogun Labs (same Marketplace Partner record as Recap and Field Hygiene)
- Pricing: free ≤10 users, **$1.50/user/month** above that — owner-approved 2026-08-07.

## A note this listing must get right, unlike Recap's and Field Hygiene's

Passdown does **not** qualify for the "Runs on Atlassian" badge — the schedule-read relay costs
that eligibility. Do not claim it anywhere in the listing copy, imagery, or FAQ. This is
deliberately not mentioned on the marketing-facing parts of the site either (per the owner's
"no-need-to-know for casual visitors" call) but must never be falsely claimed here.
