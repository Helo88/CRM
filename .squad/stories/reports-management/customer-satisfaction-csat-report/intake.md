# Story intake

- Folder: `.squad/stories/reports-management/customer-satisfaction-csat-report/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Reports Management
- **Feature slug (folder under `plans/`):** `reports-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `42` *(Story 42 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `reports-management`

---

## Title

```
Customer satisfaction (CSAT) report
```

---

## Acceptance criteria

```
- Aggregates feedback submitted in Story 38.
- Filterable by agent, category, and time period.
- Low scores can be drilled into to see the related ticket/chat and
  comment.
```

---

## Description

```
As a manager/admin, I want to see aggregated customer satisfaction
scores, so that I can measure and improve service quality.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 38 (submit feedback) — this report has nothing to aggregate without the `Feedback` model that story creates.
- **Depends on code areas or other stories:** `Feedback` model (Story 38: `parentType`, `parentId`, `rating`, `comment`, `createdAt`), `Ticket`/`Conversation` (`assignedAgent`, `category` for the filter dimensions — join via `parentId`).

## Extra notes (optional)

- "Filterable by agent/category" requires joining `Feedback` back to `Ticket`/`Conversation` via `parentType`+`parentId` to reach `assignedAgent`/`category`, since `Feedback` itself doesn't carry those fields — a Mongoose aggregation pipeline with a `$lookup`-style join (or two queries merged in application code) is needed; note the approach.
- "Drill into low scores" — return enough identifying data (parent id/type) per feedback row for the frontend to link to the underlying ticket/conversation (once those detail pages exist).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("admin")`.

## Out of scope

- Feedback submission itself (Story 38, separate, already-planned story) — this story only reads/aggregates.
- Other report types (Stories 39-41, 43, separate stories).
