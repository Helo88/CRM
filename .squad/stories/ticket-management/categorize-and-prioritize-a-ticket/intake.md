# Story intake

- Folder: `.squad/stories/ticket-management/categorize-and-prioritize-a-ticket/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `9` *(Story 9 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ticket-management`

---

## Title

```
Categorize and prioritize a ticket
```

---

## Description

```
As an agent, I want to assign a category and priority level to a ticket, so
that urgent or relevant issues are handled with the right level of
attention.
```

---

## Acceptance criteria

```
- Categories and priority levels are configurable by an admin (Story 47).
- Category/priority can be changed at any time and is logged.
- Tickets can be filtered and sorted by category and priority.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 8 (submit a ticket) — a ticket must exist to categorize. Story 47 (system configuration, `security-admin` feature) is the eventual source of configurable categories, but that feature is planned much later than this one in the build order — this story should NOT block on it (see Extra notes).
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`category: string | null`, `priority: TicketPriority = "low"|"medium"|"high"|"urgent"` already on the schema), `backend/src/routes/ticket.routes.ts` (`GET /` list stub, currently `501`).

## Extra notes (optional)

- Story 47 (admin-configurable categories) does not exist yet and is many features away in the build order. For THIS story, treat category as a free-form string field already supported by the schema (`category: string | null`) — do not build a category-configuration admin UI/endpoint now; that is Story 47's job later. This story only needs an endpoint to SET category/priority on an existing ticket.
- "Changed at any time and is logged" implies some form of change history. There is no dedicated audit-log/history model yet in this codebase (Story 13, "View full ticket history," and Story 46, "Review audit logs," are separate, later stories). For this story, at minimum update `Ticket.updatedAt` (already automatic via the schema's `timestamps: true`) — if a full audit trail is expected, flag that as depending on Story 13's data model rather than inventing one here.
- "Filtered and sorted by category and priority" is a `GET /` query-parameter concern on the existing ticket list stub.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("agent", "admin")` for the category/priority-setting endpoint (customers should not be able to set these).

## Out of scope

- Admin-configurable category/priority lists (Story 47, separate, later feature).
- Full change-history/audit trail (Stories 13 and 46, separate stories).
