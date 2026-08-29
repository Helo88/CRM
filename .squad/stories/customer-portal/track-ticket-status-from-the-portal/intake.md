# Story intake

- Folder: `.squad/stories/customer-portal/track-ticket-status-from-the-portal/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Customer Portal
- **Feature slug (folder under `plans/`):** `customer-portal`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `36` *(Story 36 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `customer-portal`

---

## Title

```
Track ticket status from the portal
```

---

## Acceptance criteria

```
- Portal lists the customer's tickets with current status and
  last-updated time.
- Status updates reflect agent changes in real time (or on refresh).
- Customer can open a ticket to see the conversation so far.
```

---

## Description

```
As a customer, I want to see the live status of tickets I've submitted, so
that I know what's happening without asking an agent.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

> **STATUS (2026-08-30): subsumed into `ticket-management`'s Story 60 intake** (`.squad/stories/ticket-management/view-and-filter-the-ticket-queue/intake.md`), built in the same pass as that story and `platform` Story 59 — see that intake's "MERGED SCOPE" note for why (this story, Story 60, and Story 59 all converge on the same `GET /api/v1/tickets` stub and the same ticket-detail page). Don't plan/build this intake separately; it's kept here as the original acceptance-criteria source, not as a standalone target.

- **Blocked by / related ids:** Story 8 (submit a ticket), Story 11 (update ticket status) — this story is explicitly what those two stories' intakes pointed forward to (Story 11's acceptance criteria literally says "Customers see the current status when viewing their ticket (Story 35)").
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`status`, `updatedAt`), `backend/src/routes/ticket.routes.ts` (`GET /` — currently a `501` stub; this story is what should implement it, scoped to `customer: req.user.id` for a customer caller, per that route's own existing TODO comment: "list tickets scoped to the caller").

## Extra notes (optional)

- This story naturally implements the `GET /api/v1/tickets` stub's customer-scoped case (the TODO on that stub already anticipates: "their own if customer, assigned if agent, all if admin" — this story only needs the CUSTOMER branch; agent/admin branches belong to Story 13/20, not here, though a competent executor may implement the full role-branching in one pass if it's not meaningfully more work — note either way).
- "Real time (or on refresh)" — the "or" makes this non-blocking: a simple `GET`-on-load list is acceptable; Socket.io push is a nice-to-have, not required.
- This is a customer-facing FRONTEND page — `frontend/app/` still only has the placeholder landing page; this story likely needs real frontend work (a tickets list page) using the established shadcn/ui design system (see `CLAUDE.md`, "Design system" section).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("customer")` for the customer-scoped list; reuse the shadcn/ui primitives already in `frontend/components/ui/` (card, badge for status, table).

## Out of scope

- Agent/admin ticket list views (Story 13/20, separate stories).
- Full support history including closed/resolved items with search (Story 36, separate, immediately-following story).
