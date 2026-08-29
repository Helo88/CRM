# Story intake

- Folder: `.squad/stories/customer-portal/view-full-support-history/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Customer Portal
- **Feature slug (folder under `plans/`):** `customer-portal`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `37` *(Story 37 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `customer-portal`

---

## Title

```
View full support history
```

---

## Acceptance criteria

```
- Resolved/closed items remain visible and searchable in the portal.
- Customer can reopen a resolved ticket if the issue recurs.
- History includes attachments and replies exchanged.
```

---

## Description

```
As a customer, I want to view my past tickets and chats and their
outcomes, so that I have a record of previous support interactions.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 35 (track ticket status from portal) — this story extends that same customer-scoped ticket list to include closed items + search, plus adds conversation history. Story 6 (`customer-management`, view interaction history) built a similar agent-facing merge of tickets+conversations — reuse that query pattern (customer-scoped instead of admin-scoped) rather than reinventing it.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts`, `backend/src/models/Conversation.ts`, `backend/src/models/Message.ts` (for "replies exchanged").

## Extra notes (optional)

- "Reopen a resolved ticket" needs a status transition FROM `"closed"` back to an active status — this isn't in Story 11's original New→InProgress→Answered→Closed sequence; treat as a new, explicitly customer-triggerable transition (e.g. `closed → in_progress`), distinct from staff-driven transitions.
- "Searchable" — reuse Story 30's text-search infrastructure if it targets ticket/conversation content, OR a simple filter by subject/date if Story 30 only covers the knowledge base (check what Story 30 actually built by the time this is planned — its scope was FAQs/articles, not necessarily tickets, so this story likely needs its OWN simple search/filter over `Ticket`/`Conversation`, not a reuse of Story 30).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("customer")`, scoped to `customer: req.user.id` throughout.

## Out of scope

- Live status tracking of open tickets (Story 35, separate, already-related story — this one focuses on the historical/closed view).
- FAQ browsing (Story 37, separate story).
- Feedback submission (Story 38, separate story).
