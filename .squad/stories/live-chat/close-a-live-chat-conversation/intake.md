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

- **Blocked by / related ids:** Story 18 (agent replies in real time) — **shipped**. Story 17 (auto-assign an escalated chat) — **shipped**, and already built a *minimal* `conversation:close` socket handler (`backend/src/sockets/chat.socket.ts`) as part of its own "no agent available → keep chatting or close" hint, scoped **customer-only** at the time. This story is what widens that same handler so the assigned agent (or admin) can also mark a chat resolved — the actual "As a human agent, I want to mark a live chat as resolved" acceptance criterion this story is named for was NOT satisfied by Story 17's narrower version. Do not build a second close mechanism; widen the existing one.
- **Depends on code areas or other stories:** `backend/src/models/Conversation.ts` (`status: ConversationStatus` — `"resolved"` already in the enum; `timestamps: true` on the schema already gives `updatedAt`, already used as the "closed timestamp" — no dedicated field needed, matches how `Ticket` does it). `backend/src/sockets/chat.socket.ts`'s `isAuthorizedOnConversation(user, conversation)` (Story 18) — the customer, its `assignedAgent`, or any admin — is the exact authorization rule this story's widened close check should reuse, rather than the narrower "must be the customer" check the current handler has. `frontend/app/chats/[id]/AgentChatPanel.tsx` (Story 18) already has a `// TODO(Story 19): mark-resolved button goes in the header row` comment marking where this story's UI lands, and already disables its composer + shows "This conversation is closed" when `conversation.status === "resolved"` — reuse that, don't rebuild it.

## Extra notes (optional)

- "Customer sees a closed indicator" — **already shipped** by Story 17: `frontend/app/chat/LiveChatPanel.tsx` listens for `conversation:closed` and renders a destructive alert with `t("closed")`. Verify only.
- "Remain viewable read-only" — **already shipped**: `chat.socket.ts`'s `conversation:message` handler already rejects sends once `status === "resolved"`; `GET /api/v1/conversations/:id` (Story 18) has no status restriction, so a resolved conversation's transcript stays readable. The one real gap: `GET /api/v1/conversations` (Story 18's staff list) filters to `{ status: { $in: ["escalated", "with_agent"] } }` — a resolved conversation drops out of that list entirely once closed, so an agent/admin who doesn't already have the URL loses the discovery path to it. Decide explicitly whether this story needs to widen that list (e.g. an "include resolved" filter/tab) or whether that's acceptable to leave for a later history-specific story — don't leave it silently unaddressed either way.
- The actual net-new work for this story is narrow: (1) widen the `conversation:close` handler's authorization from customer-only to `isAuthorizedOnConversation`-equivalent (customer, assignedAgent, or admin), and (2) add the agent-facing "Mark resolved" button in `AgentChatPanel.tsx` at the TODO anchor, emitting the same `conversation:close` event the customer path already uses.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Do **not** add a REST endpoint for this — live-chat's established pattern (Stories 16/17) is socket-only for every conversation-state-changing action; a REST `close/resolve` endpoint would be a second parallel mechanism for the same concern.

## Out of scope

- Customer feedback/rating after resolution (Story 38, `customer-portal` feature, separate, much later story).
- A full "closed chats" history page/tab — only decide (per Extra notes) whether the existing staff list needs to surface resolved conversations at all; building a polished history view is later scope.
