# Story intake

- Folder: `.squad/stories/ticket-management/auto-assign-a-ticket-to-an-available-agent/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `10` *(Story 10 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ticket-management`

---

## Title

```
Auto-assign a ticket to an available agent
```

---

## Description

```
As the system, I want to automatically assign a new ticket to the first
available (online) agent, so that every ticket has an owner without manual
dispatching.
```

---

## Acceptance criteria

```
- Assignment happens as soon as the ticket is created.
- The assigned agent is notified (in-app and/or email).
- Ticket ownership is visible to the assigned agent and the admin, and can
  be manually reassigned (Story 41).
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 8 (submit a ticket) — auto-assignment triggers at ticket creation, so this hooks into that creation path.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`assignedAgent: Types.ObjectId | null`), `backend/src/models/User.ts` (`isOnline: boolean`, `role` — "the first available (online) agent" means query `User.find({ role: "agent", isOnline: true })`), `backend/src/services/email.service.ts` (for the email notification option).

## Extra notes (optional)

- "First available (online) agent" — with no other ordering signal in the acceptance criteria or the data model, use a deterministic tiebreaker (e.g. fewest currently-assigned open tickets, or creation-order/oldest-online-first) and state the chosen rule explicitly in the plan rather than leaving it ambiguous — Story 17 (live-chat's equivalent auto-assignment) explicitly calls out avoiding double-assignment on simultaneous events; the same concurrency care applies here even though it's not spelled out in this story's acceptance criteria.
- `isOnline` toggling itself is Story 21 (`agent-workspace` feature, "Agent availability toggle") — a LATER story. Until Story 21 ships, no code path sets `isOnline: true` on any agent, meaning this story's auto-assignment query would always find zero eligible agents in practice. Flag this as a known cross-story dependency rather than silently working around it (e.g. don't invent an alternate "availability" signal not in the data model).
- "In-app" notification implies some notification mechanism/model that doesn't exist yet in this codebase (no `Notification` model). If none is judged in-scope to build fresh here, the email path (already supported via `email.service.ts`) can satisfy the "and/or" wording in the acceptance criteria on its own — don't invent a full notification system unprompted.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- This logic should be reusable by live-chat's Story 17 later ("same mechanism as live chat" per `USER_STORIES.md`'s confirmed flow decisions) — write it so the "find first available agent" query isn't hardcoded to ticket-specific concerns only, even though only tickets call it in this story.

## Out of scope

- Agent availability toggle itself (Story 21, separate, later story) — this story's assignment logic depends on `isOnline` but does not implement how it gets set.
- Manual reassignment UI/endpoint (Story 41, separate, later story) — this story only needs assignment to be visible/queryable, not reassignable yet.
- Live-chat's parallel auto-assignment (Story 17) — separate story, though the underlying mechanism may be shared per Technical hints.
