# Story intake

- Folder: `.squad/stories/live-chat/close-a-live-chat-conversation/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Live Chat
- **Feature slug (folder under `plans/`):** `live-chat`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `19` *(Story 19 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `live-chat`

---

## Title

```
Close a live chat conversation
```

---

## Description

```
As a human agent, I want to mark a live chat as resolved, so that it's
clearly closed and leaves my active queue.
```

---

## Acceptance criteria

```
- Closing updates status and records a closed timestamp.
- Customer sees a "conversation closed" indicator.
- Closed conversations remain viewable read-only in history.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 18 (agent replies in real time).
- **Depends on code areas or other stories:** `backend/src/models/Conversation.ts` (`status: ConversationStatus` — `"resolved"` already in the enum; `timestamps: true` on the schema already gives `updatedAt`, which can serve as the "closed timestamp," or a dedicated field can be added if a distinct semantic is needed — note which).

## Extra notes (optional)

- "Customer sees a closed indicator" needs a real-time push — reuse the same Socket.io room (`conversation:${conversationId}`, already used by `conversation:join`/`conversation:message` in `chat.socket.ts`) to emit a status-change event, rather than requiring the customer to poll or refresh.
- "Remain viewable read-only" — no delete endpoint exists on conversations, so this mainly means: once `status === "resolved"`, further `conversation:message` sends for that conversation should be rejected (or at least not treated as active), not that a new endpoint is needed to "view" it (the existing read path, once Story 18 defines one, already covers this).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("agent","admin")` for the close/resolve endpoint.

## Out of scope

- Customer feedback/rating after resolution (Story 38, `customer-portal` feature, separate, much later story).
