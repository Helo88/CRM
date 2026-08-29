# Story intake

- Folder: `.squad/stories/ticket-management/get-support-choose-a-ticket-or-live-chat/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `53` *(Story 53 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ticket-management`

---

## Title

```
Get support — choose a ticket or live chat
```

---

## Description

```
As a logged-in customer, I want to land on one clear starting point that lets
me choose between submitting a ticket or starting a live chat, so that I
don't have to guess which nav link gets me help.
```

---

## Acceptance criteria

```
- A single "Get support" entry point presents both options clearly, with a
  one-line description of when each fits (e.g. live chat for something that
  needs a real-time back-and-forth, a ticket for something that doesn't).
- Choosing an option takes the customer directly into that flow — Story 8's
  submit-ticket form, or `live-chat` Story 14's chat widget — no extra
  intermediate step.
- A real page (e.g. `/support`) is this story's actual deliverable, not a
  design note — linked from the persistent nav for any signed-in customer.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None yet — this story has no mockup from the ticket-views design pass (that covered the ticket list/detail screens, not this entry point). Add a screenshot here if one gets made before planning.

---

## Dependencies

- **Blocked by / related ids:** None — this is the entry point into the feature; Story 8 (submit a ticket) and `live-chat` Story 14 (start a live chat) are the two destinations it links to, but neither needs to exist for this page itself to render (the links can 404 until they land).
- **Depends on code areas or other stories:** `frontend/components/SiteHeader.tsx` (persistent nav — this page's link goes here, per the project convention that no authenticated action should only be reachable via another page's ad hoc link). No backend change — this is routing/UI only.

## Extra notes (optional)

- This is a customer-only page (`requireAuth`, no role check beyond "is a customer" — agents/admins don't use this entry point, they work from their own dashboard per `agent-workspace` Story 20).
- Keep this to the two-option chooser only. Do not build the submit-ticket form or chat widget here — those are Story 8 and `live-chat` Story 14's jobs respectively.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- New route: `frontend/app/support/page.tsx`, a Server Component per the project's auth pattern (reads the session cookie, no client-side auth check).
- Every user-facing string goes through `next-intl` — add a `Support` section to `frontend/messages/en.json` and `frontend/messages/ar.json` in the same change (see CLAUDE.md's i18n convention).
- Needs `export const metadata` (or the page is a Server Component so a static `Metadata` export is fine) — this is a public-to-signed-in-customers page, so give it a real title/description, not `robots: noindex` (see CLAUDE.md's SEO convention — this isn't an internal/admin page).

## Out of scope

- The actual ticket-submission form (Story 8).
- The actual live-chat widget (`live-chat` Story 14).
