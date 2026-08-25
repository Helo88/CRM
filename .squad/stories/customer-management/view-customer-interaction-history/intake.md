# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/customer-management/view-customer-interaction-history/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Customer Management
- **Feature slug (folder under `plans/`):** `customer-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `6` *(Story 6 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `customer-management`

---

## Title

```
View customer interaction history
```

---

## Description

```
As an agent, I want to see a single timeline of all of a customer's past
tickets and chats, so that I have full context before responding.
```

---

## Acceptance criteria

```
- Timeline is chronological and shows channel (chat/email-ticket), subject,
  and status per item.
- Clicking an item opens the original ticket/conversation.
- Timeline is visible from the customer's profile and from any of their open
  tickets/chats.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 4 (customer profile, this timeline is linked from it). Depends on `Ticket` and `Conversation` data existing — `ticket-management` (Stories 8-13) and `live-chat` (Stories 14-19) are planned/implemented in parallel with this feature per the build order, so ticket/conversation creation may still be stubs when this story is planned; the endpoint should be written against the real Mongoose models (`Ticket`, `Conversation`) regardless of whether the create endpoints are finished yet.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`ITicket`: `subject`, `status`, `customer`, `createdAt`), `backend/src/models/Conversation.ts` (`IConversation`: `status`, `customer`, `createdAt` — note `Conversation` has no `subject` field, only `Ticket` does; the timeline item shape needs to handle that difference, e.g. a generated label for conversations), `backend/src/middleware/auth.ts` (`requireAuth`, `requireRole("agent","admin")`).

## Extra notes (optional)

- This is a read/aggregation endpoint: merge `Ticket` and `Conversation` documents for one `customer` id into one chronological list, sorted by `createdAt`, each item tagged with its channel (`"ticket"` vs `"chat"`).
- "Clicking an item opens the original ticket/conversation" is a frontend concern (link/navigation) — the backend's job is just to return enough identifying info (`id`, `type`) for the frontend to route to the right detail view; there is no ticket/conversation detail screen built yet in `frontend/`, so the frontend piece of this story may be limited to the timeline list itself.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Consider whether this belongs as a sub-resource of the customer routes (e.g. `GET /api/v1/customers/:id/history`) rather than a new top-level route — follow whatever routing decision Story 4 made for `backend/src/routes/customer.routes.ts` (if that file exists by the time this is planned/implemented) or create it if not (see Story 4's intake for that same open decision).

## Out of scope

- Editing/replying to a ticket or chat from the timeline — this is a read-only view (the acceptance criteria says "opens the original", not "edits inline").
- Full ticket-management or live-chat feature implementation — this story only reads existing `Ticket`/`Conversation` documents.
