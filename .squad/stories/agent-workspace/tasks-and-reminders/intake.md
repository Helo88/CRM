# Story intake

- Folder: `.squad/stories/agent-workspace/tasks-and-reminders/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Agent Workspace
- **Feature slug (folder under `plans/`):** `agent-workspace`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `22` *(Story 22 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `agent-workspace`

---

## Title

```
Tasks and reminders
```

---

## Description

```
As a human agent, I want to set a task/reminder linked to a ticket or
chat, so that I don't forget a needed follow-up.
```

---

## Acceptance criteria

```
- A reminder can be set for a specific date/time on any ticket or chat.
- The agent is notified when a reminder is due.
- Open reminders are visible in a personal to-do list on the dashboard.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 20 (unified dashboard) — the to-do list surfaces here.
- **Depends on code areas or other stories:** No existing model for reminders/tasks — this story needs a NEW Mongoose model (e.g. `Reminder`: `agent`, `parentType: "ticket"|"conversation"`, `parentId`, `dueAt`, `note`, `completed`), following the `parentType`/`parentId` pattern already established by `backend/src/models/Message.ts` for referencing either a ticket or a conversation.

## Extra notes (optional)

- "The agent is notified when a reminder is due" needs a due-time check — same class of problem as sla-automation's breach alerts (Story 27): requires something running proactively (background job/scheduler), not just on-request. If Story 27 already established a scheduler pattern by the time this is planned/executed, reuse it rather than building a second one.
- No notification model exists (same gap noted in ticket-management Stories 10/12) — "notified" here could mean a real-time Socket.io push to the agent (if online) and/or surfacing overdue reminders when the dashboard loads. Don't invent an email notification for this unless the acceptance criteria implies it (it doesn't explicitly).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("agent","admin")`. A reminder is personal to the agent who set it — scope all reads/writes to `req.user.id`.

## Out of scope

- Quick replies (Story 23, separate story).
- Internal team collaboration / tagging (Story 24, separate story).
