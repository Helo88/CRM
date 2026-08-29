# Story intake

- Folder: `.squad/stories/reports-management/ticket-reports/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Reports Management
- **Feature slug (folder under `plans/`):** `reports-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `40` *(Story 40 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `reports-management`

---

## Title

```
Ticket reports
```

---

## Description

```
As a manager/admin, I want to see reports on ticket volume, type, and
trends over time, so that I understand the team's overall workload.
```

---

## Acceptance criteria

```
- Filterable by date range, category, and channel (chat/ticket).
- Exportable (CSV/PDF).
- Trends shown visually as well as in tables.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** ticket-management (Stories 8-13) and live-chat (Stories 14-19) for the underlying data.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts`, `backend/src/models/Conversation.ts` — aggregation queries (Mongoose `aggregate()`) grouped by `createdAt` (date range), `category`, and channel (ticket vs. conversation, i.e. which collection).

## Extra notes (optional)

- "Exportable (CSV/PDF)" — no export mechanism exists anywhere in this codebase yet (same gap flagged in ticket-management Story 13's intake). CSV is straightforward (stream/format rows, no new dependency strictly required). PDF generation typically needs a new dependency (e.g. a PDF-generation library) — note this as a new dependency decision rather than silently picking one; CSV alone may be an acceptable first pass if PDF is judged out of proportion, but state that explicitly rather than silently dropping half the acceptance criteria.
- "Trends shown visually" is a FRONTEND charting concern — no charting library exists in `frontend/package.json` yet; this is a new frontend dependency decision (e.g. a lightweight charting library) — note explicitly rather than assuming one is already available.
- This is the first of 5 reports-management stories (39-43); if a shared aggregation/query-building pattern makes sense across them (e.g. common date-range/filter parsing), establish it here since this is the first.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("admin")` (manager role isn't in the current `UserRole` enum — treat "manager" as `"admin"` unless a broader role model exists by the time this is planned).

## Out of scope

- SLA/agent/CSAT-specific reports (Stories 40-42, separate stories in this same feature).
- The unified management dashboard (Story 43, separate, immediately-following story).
