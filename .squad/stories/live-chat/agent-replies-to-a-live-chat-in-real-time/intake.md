# Story intake

- Folder: `.squad/stories/live-chat/agent-replies-to-a-live-chat-in-real-time/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Live Chat
- **Feature slug (folder under `plans/`):** `live-chat`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `18` *(Story 18 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `live-chat`

---

## Title

```
Agent replies to a live chat in real time
```

---

## Description

```
As a human agent, I want to see my assigned live chats and reply in real
time, so that I can resolve the customer's issue directly.
```

---

## Acceptance criteria

```
- Agent sees the full conversation, including prior AI messages, before
  replying.
- Messages the agent sends appear instantly for the customer via WebSocket.
- Agent can mark the conversation resolved (Story 19) once done.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 17 (auto-assign an escalated chat) — **shipped**. `Conversation.status` can now be `"with_agent"` with `assignedAgent` populated; a `conversation:assigned` socket event already fires the moment assignment happens (`backend/src/sockets/chat.socket.ts`, right after the `conversation:escalate` handler). This story is the agent-facing counterpart that finally lets that assigned agent actually see and reply to the chat — right now nothing does.
- **Depends on code areas or other stories:** `backend/src/models/Message.ts` (`senderType: "agent"` already in the enum), `backend/src/sockets/chat.socket.ts` (294 lines now — `conversation:join`, `conversation:message`, `conversation:escalate`, `conversation:close` handlers all already there), `backend/src/middleware/auth.ts` (`requireAuth`, `requireRole("agent","admin")` for agent-facing endpoints).

## Extra notes (optional)

- "Sees the full conversation, including prior AI messages" is a read endpoint (`GET` messages for a conversation) — likely `GET /api/v1/conversations/:id` or a nested messages route; none exists yet (`conversation.routes.ts` only has the `POST /` create handler — the old escalate stub was removed by Story 16). Decide the route shape and note it.
- "Messages the agent sends appear instantly via WebSocket" reuses the same `conversation:message` socket event Story 14 wires for customers — an agent sending a message should go through the same persistence + broadcast path, just with `senderType: "agent"` and `senderId` set to the agent's id from `req.user`/the authenticated socket.
- **Real gap found while planning Story 17:** `isAuthorizedOnConversation(userId, conversation)` (`chat.socket.ts`) only returns true for the conversation's own `customer` or its `assignedAgent` — it has no admin bypass. This story's own acceptance criterion ("Admin can also reply to any live chat, not just their own assigned ones") cannot be satisfied without widening that check (e.g. `|| callerRole === "admin"`, which needs the role available at the call site — it currently isn't passed in, only the user id). Fix this as part of this story, not a follow-up.
- **Frontend is NOT optional for this story** per `CLAUDE.md`'s "every persona-facing capability ships its frontend UI in the same story" — Story 20 (`agent-workspace`, full unified dashboard) is a later feature, but this story still needs *some* minimal, reachable surface for an agent to see their assigned chats and reply (e.g. a simple `/chats` list + detail view, reusing `LiveChatPanel.tsx`'s message-rendering patterns rather than the full dashboard). Scope it the same way the agent-availability-toggle story scoped itself down below full Story 21 — small and functional, not polished, but real and shipped.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- Marking a conversation resolved (Story 19, separate, immediately-following story — this story only says the agent "can" do it once Story 19 exists).
- The full agent dashboard (Story 20, `agent-workspace` feature, separate, later feature).
