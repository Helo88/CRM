# Story intake

- Folder: `.squad/stories/ticket-management/view-full-ticket-history/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `13` *(Story 13 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ticket-management`

---

## Title

```
View full ticket history
```

---

## Description

```
As an agent or admin, I want to view the complete history/audit trail of a
ticket, so that I can see what actions were taken, by whom, and when.
```

---

## Acceptance criteria

```
- History includes status changes, reassignments, category changes,
  replies, and internal notes.
- History is read-only for regular agents.
- History is exportable for record-keeping.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| `attachments/agent-detail-recent-activity.png` | The trimmed "Recent activity" teaser in the agent ticket-detail sidebar. |
| `attachments/subadmin-detail-full-history.png` | The full timeline plus "Export history" button in the sub-admin ticket-detail sidebar. |

*(Both screenshots are in place under `attachments/`.)*

---

## Dependencies

- **Blocked by / related ids:** Stories 8-12 (ticket creation, categorization, assignment, status, escalation) — this story surfaces the combined history of actions those stories perform. `backend/src/models/Message.ts` already models replies (`parentType: "ticket"`, `senderType`, `internal: boolean`) — internal notes on a ticket are `Message` documents with `internal: true`.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts`, `backend/src/models/Message.ts` (`messageSchema.index({ parentType: 1, parentId: 1, createdAt: 1 })` already indexed for exactly this kind of chronological query).

## Extra notes (optional)

- This story is the consumer of the status-history / category-change-log design decisions made in Stories 9 and 11's intakes (both flagged as open design decisions — a `statusHistory`-style array vs. a separate audit model). Whichever those stories land on, this story's history endpoint should read from it — don't invent a THIRD, different history mechanism; if those stories haven't been planned/implemented yet, note that as a real blocking dependency rather than fabricating placeholder history data.
- "Exportable for record-keeping" — no export mechanism (CSV/PDF) exists anywhere in this codebase yet. A minimal interpretation is returning the full history as JSON from a `GET` endpoint (which any client can then save/export); building a formatted CSV/PDF exporter is a larger, separate concern — note which interpretation is chosen rather than silently picking the heavier one unprompted.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- **Correction from an earlier version of this intake:** `UserRole` is actually `"customer" | "agent" | "admin" | "subadmin"` (`backend/src/models/User.ts`) — the security-admin permission model already exists. "Read-only for regular agents" maps cleanly onto that: history viewing itself needs no new permission beyond ticket access, but from the approved "Ticket Views" mockup, the "Export history" action is only shown to accounts with broader ticket permissions (e.g. `tickets:view_all`) — a plain agent sees a trimmed "recent activity" teaser with a "view full history" link but no export button. Add a permission key for export specifically (e.g. `tickets:export_history`) rather than overloading `tickets:view_all` for it, and put it in `SUBADMIN_ONLY_PERMISSIONS`.
- `requireAuth` + a base ticket-access check for viewing; `requirePermission("tickets:export_history")` for the export endpoint, per `[[feedback_every_route_needs_permission]]`.
- Frontend: this shows up in two places per the mockup — a compact "Recent activity" list in the agent ticket-detail sidebar, and the full exportable timeline in the sub-admin ticket-detail sidebar. Story 60 ("view and filter the ticket queue") also links out to a ticket's detail view where this timeline lives — no separate page needed.

## Out of scope

- Ticket status/category/assignment mutation logic itself (Stories 9-12, separate stories) — this story only reads and aggregates.
- A full CSV/PDF export pipeline, unless explicitly chosen as the interpretation per Extra notes.
