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
- Categories and priority levels are configurable by an admin (Story 58).
- Category/priority can be changed at any time and is logged.
- Filtering/sorting the ticket list by category and priority is the ticket
  queue's job (Story 60), not this story — this story is just the
  per-ticket assignment action.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| `attachments/agent-detail-sidebar.png` | The Status/Category/Priority select fields in the agent ticket-detail sidebar, from the approved "Ticket Views" mockup. |

*(Screenshot is in place under `attachments/`.)*

---

## Dependencies

- **Blocked by / related ids:** Story 8 (submit a ticket) — a ticket must exist to categorize. Story 58 (manage ticket categories and priorities, same feature) is the source of the configurable category list this story's picker reads from — build Story 58 first even though it's numbered higher (see the `ticket-management` numbering note in `USER_STORIES.md`). Story 60 (view and filter the ticket queue) owns list-level filtering/sorting by category and priority — do not build that here.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`category: string | null`, `priority: TicketPriority`), `backend/src/routes/ticket.routes.ts` (no per-ticket PATCH endpoint exists yet — this story adds one), `backend/src/constants/permissions.ts` (needs new permission keys — see Technical hints).

## Extra notes (optional)

- **Superseded from an earlier version of this intake:** this file previously said "treat category as free-form, do not build a category-configuration admin UI — that's Story 47's job later." That's no longer correct — Story 58 (renumbered from the earlier "Story 47"/"Story 48") now builds that admin UI *before* this story, deliberately pulled forward so this story has real categories to assign rather than a free-text field. If Story 58 isn't implemented yet when this story is planned, fall back to free-text category as the earlier note described, and flag that as a known gap to close once Story 58 lands.
- "Changed at any time and is logged" implies some form of change history. There is no dedicated audit-log/history model yet — Story 13 ("View full ticket history") is the eventual home for a real audit trail. For this story, at minimum rely on `Ticket.updatedAt` (already automatic via `timestamps: true`); if Story 13 already exists by the time this is planned, append to its history mechanism instead of inventing a second one.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- This story needs two new permission keys in `backend/src/constants/permissions.ts`'s `PERMISSION_KEYS`: `tickets:categorize` (sets category) and `tickets:change_priority` (sets priority) — both day-to-day agent actions, so add both to `DEFAULT_PERMISSIONS_BY_ROLE.agent`, neither to `SUBADMIN_ONLY_PERMISSIONS`. Gate the new PATCH endpoint(s) with `requirePermission(...)` per `[[feedback_every_route_needs_permission]]`, not a bare `requireRole("agent", "admin")`.
- New endpoint, e.g. `PATCH /api/v1/tickets/:id` (or split into `/:id/category` and `/:id/priority` if that's cleaner) — `ticket.routes.ts` currently only has `POST /` and `GET /` stubs.

## Out of scope

- Admin-configurable category/priority *lists* (Story 58, separate story in this same feature).
- List-level filtering/sorting by category/priority (Story 60, separate story).
- Full change-history/audit trail beyond `updatedAt` (Story 13, separate story).
