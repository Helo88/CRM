# Story intake

- Folder: `.squad/stories/reports-management/sla-performance-report/intake.md`

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
SLA performance report
```

---

## Description

```
As a manager/admin, I want to see how well the team meets its SLA
targets, so that I can track whether service promises are being kept.
```

---

## Acceptance criteria

```
- Shows percentage of items meeting vs. breaching targets.
- Breakdown by agent and by category/priority.
- Breach trends trackable over time.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** sla-automation (Stories 25-27) — this report has nothing to aggregate without `Ticket.sla`/`Conversation.sla` data being populated by those stories. Story 39 (ticket reports) for shared aggregation patterns, if established.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`sla.breached`, `assignedAgent`, `priority`, `category`), `backend/src/models/Conversation.ts` (`sla.breached`, `assignedAgent`).

## Extra notes (optional)

- "Breach trends over time" needs breach EVENTS with timestamps, not just a current boolean `sla.breached` flag — if sla-automation's Story 27 only flips a boolean without recording WHEN it flipped, historical trend data isn't reconstructable after the fact. Flag this dependency explicitly: this report needs either a breach-event log (ties to Story 46's audit log, or a dedicated one) or accepts only current-snapshot reporting (no true historical trend) until that exists.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("admin")`.

## Out of scope

- Ticket volume/type reports (Story 39, separate story).
- Agent/CSAT-specific reports (Stories 41-42, separate stories).
