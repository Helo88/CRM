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

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 8-12 (ticket creation, categorization, assignment, status, escalation) — this story surfaces the combined history of actions those stories perform. `backend/src/models/Message.ts` already models replies (`parentType: "ticket"`, `senderType`, `internal: boolean`) — internal notes on a ticket are `Message` documents with `internal: true`.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts`, `backend/src/models/Message.ts` (`messageSchema.index({ parentType: 1, parentId: 1, createdAt: 1 })` already indexed for exactly this kind of chronological query).

## Extra notes (optional)

- This story is the consumer of the status-history / category-change-log design decisions made in Stories 9 and 11's intakes (both flagged as open design decisions — a `statusHistory`-style array vs. a separate audit model). Whichever those stories land on, this story's history endpoint should read from it — don't invent a THIRD, different history mechanism; if those stories haven't been planned/implemented yet, note that as a real blocking dependency rather than fabricating placeholder history data.
- "Exportable for record-keeping" — no export mechanism (CSV/PDF) exists anywhere in this codebase yet. A minimal interpretation is returning the full history as JSON from a `GET` endpoint (which any client can then save/export); building a formatted CSV/PDF exporter is a larger, separate concern — note which interpretation is chosen rather than silently picking the heavier one unprompted.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("agent", "admin")`. "Read-only for regular agents" — if there's an implicit senior-agent/admin distinction for EDITING history, note that the current `UserRole` enum only has `"customer" | "agent" | "admin"` (no "senior agent" tier) — don't invent a new role value without flagging it.

## Out of scope

- Ticket status/category/assignment mutation logic itself (Stories 9-12, separate stories) — this story only reads and aggregates.
- A full CSV/PDF export pipeline, unless explicitly chosen as the interpretation per Extra notes.
