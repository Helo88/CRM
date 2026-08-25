# Story intake

- Folder: `.squad/stories/live-chat/auto-assign-an-escalated-chat-to-an-available-agent/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Live Chat
- **Feature slug (folder under `plans/`):** `live-chat`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `17` *(Story 17 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `live-chat`

---

## Title

```
Auto-assign an escalated chat to an available agent
```

---

## Description

```
As the system, I want to automatically assign an escalated chat to the
first agent marked online, so that no chat waits for someone to notice it
manually.
```

---

## Acceptance criteria

```
- Assignment happens within seconds of escalation.
- If no agent is online, the customer is told to expect a delay and offered
  the email/ticket path instead.
- Two escalations at the same instant don't get double-assigned to the
  same agent.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 16 (escalate to a human agent) — this story reacts to `Conversation.status === "escalated"`. Story 10 (`ticket-management`, "auto-assign a ticket") intended the SAME underlying mechanism per `USER_STORIES.md`'s confirmed flow decisions ("Both live chats and tickets auto-assign to the first available (online) agent") — if Story 10 is planned/implemented first and factored its "find first available agent" logic as a reusable function (see Story 10's intake, Technical hints), THIS story should call that same function rather than reimplementing it. If Story 10 hasn't been implemented yet when this is executed, note the duplication explicitly rather than silently diverging.
- **Depends on code areas or other stories:** `backend/src/models/Conversation.ts` (`assignedAgent`), `backend/src/models/User.ts` (`isOnline`, `role`).

## Extra notes (optional)

- Same caveat as Story 10: `isOnline` toggling is Story 21 (`agent-workspace`, "Agent availability toggle"), a later story — until it exists, no agent will ever be found "online" by this query. Flag this cross-story dependency rather than inventing a workaround.
- "Two escalations at the same instant don't get double-assigned to the same agent" is a real concurrency requirement — the naive "find one online agent, assign" pattern has a race if two escalations query simultaneously. Consider an atomic `findOneAndUpdate`-style claim (assign-and-mark-busy in one operation) rather than separate find-then-write steps. State the chosen approach explicitly.
- "No agent online → customer told to expect a delay, offered email/ticket path" is a customer-facing message + a suggestion to fall back to Story 8's ticket-submission flow — this doesn't require calling Story 8's code, just message text pointing the customer there.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- This fires from the same socket/event flow Story 16 uses to set `status: "escalated"` — likely the natural place to trigger assignment is right after that status change succeeds.

## Out of scope

- The agent availability toggle itself (Story 21, separate, later story).
- Ticket auto-assignment (Story 10, separate story in a different feature) — though the underlying algorithm may be shared per Dependencies.
