# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ticket-management/submit-a-ticket-comment-problem/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `8` *(Story 8 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ticket-management`

---

## Title

```
Submit a ticket (comment/problem)
```

---

## Description

```
As a logged-in customer, I want to submit a written comment or problem
through a form, so that I can report an issue without needing to be online
at the same time as an agent.
```

---

## Acceptance criteria

```
- Form captures at minimum a subject and description; attachments are
  optional.
- Submitting it creates a ticket with status "New," linked to the customer.
- Customer gets an in-app confirmation and an acknowledgment email with a
  reference number.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 1-3 (auth) — completed; needs `requireAuth`/`requireRole("customer")`.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`ITicket`: `subject`, `description`, `customer`, `assignedAgent`, `category`, `priority`, `status` — default `"new"` — `sla`, `escalatedTo`), `backend/src/routes/ticket.routes.ts` (`POST /` is currently a `501` stub already wrapped in `requireAuth, requireRole("customer")`), `backend/src/services/email.service.ts` (`sendEmail` — the only place SMTP is touched, per CLAUDE.md's service-layer rule).

## Extra notes (optional)

- Auto-assignment to an agent (mentioned in the flow decisions in `USER_STORIES.md`'s intro) is Story 10, a SEPARATE story — do not implement auto-assignment logic here; this story only creates the ticket with status `"new"` and no `assignedAgent` (or leaves that to Story 10 to wire in).
- "Acknowledgment email with a reference number" — the ticket's own MongoDB `_id` (or a shorter derived reference) can serve as the reference number; there's no separate ticket-numbering scheme in the current schema, so don't invent one without noting it as a design decision.
- Attachments are optional per the acceptance criteria, but `Ticket.ts`'s schema (as currently modeled) has no attachments field — check the model before assuming one exists; if it's missing, note that as a gap for this story to either add (a plain array field, following the pattern of `IAttachment` on `User.ts`) or flag as deferred.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `POST /api/v1/tickets` is already mounted (`backend/src/app.ts`) and already wrapped in `requireAuth, requireRole("customer")` in the stub — implement inside that existing handler signature, don't change the route's auth wrapper.

## Out of scope

- Category/priority assignment (Story 9, separate story) — new tickets can default `category: null`, `priority: "medium"` per the schema defaults.
- Auto-assignment to an agent (Story 10, separate story).
- Ticket status transitions beyond the initial `"new"` (Story 11, separate story).
