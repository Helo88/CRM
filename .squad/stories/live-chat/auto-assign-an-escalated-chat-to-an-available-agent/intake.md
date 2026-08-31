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
- If no agent is online, the customer sees a "no agent available right now"
  hint with two options: keep chatting with the AI agent, or close the
  conversation. (Revised by the user during planning — USER_STORIES.md's
  original wording, "told to expect a delay and offered the email/ticket
  path instead," is superseded by this; update USER_STORIES.md to match
  when convenient.)
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

- **Blocked by / related ids:** Story 16 (escalate to a human agent, shipped) — this story reacts to `Conversation.status === "escalated"`. Story 10 (`ticket-management`, "auto-assign a ticket") already shipped `backend/src/services/assignment.service.ts`'s `pickNextAvailableAgent()` (least-busy-online-agent, oldest-createdAt tiebreak) per `USER_STORIES.md`'s confirmed flow decisions ("Both live chats and tickets auto-assign to the first available (online) agent") — THIS story should import and call that same function, not reimplement it. It currently only considers `Ticket` load for the tiebreak; if that needs to also account for a chat load, extend it there rather than forking a second copy.
- **Depends on code areas or other stories:** `backend/src/models/Conversation.ts` (`assignedAgent`), `backend/src/models/User.ts` (`isOnline`, `role` — also shipped, Story 21).

## Extra notes (optional)

- `isOnline` toggling (Story 21) and the "first available agent" picker (Story 10) have both already shipped — no cross-story blocker remains on that front. `pickNextAvailableAgent()` is ready to import.
- "Two escalations at the same instant don't get double-assigned to the same agent" is a real concurrency requirement — the naive "find one online agent, assign" pattern has a race if two escalations query simultaneously. Consider an atomic `findOneAndUpdate`-style claim (assign-and-mark-busy in one operation) rather than separate find-then-write steps. State the chosen approach explicitly.
- "No agent online" UX (revised): show the customer a hint that no agent is available right now, with two explicit choices — (a) keep chatting with the AI agent (conversation.status reverts to/stays "ai_handling" so the existing Story 15 branch keeps answering), or (b) close the conversation (reuses Story 19's close mechanism if it exists yet; otherwise a minimal "resolved" status flip scoped to just this button, noted as a forward dependency the same way other stories note gaps on not-yet-built work). No email/ticket-path suggestion in this revision.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- This fires from the same socket/event flow Story 16 uses to set `status: "escalated"` — likely the natural place to trigger assignment is right after that status change succeeds.

## Out of scope

- Full close-conversation UI/flow (Story 19, separate story) — the "close" option in the no-agent hint only needs to be functional (reachable, does the minimum to end the conversation), not the polished version Story 19 ships.
- A full re-implementation of ticket auto-assignment (Story 10, separate story, already shipped, different feature) — reuse its `pickNextAvailableAgent()` per Dependencies.
