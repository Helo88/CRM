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

- **Blocked by / related ids:** Story 17 (auto-assign an escalated chat) — this story is the agent-facing counterpart once assignment has happened.
- **Depends on code areas or other stories:** `backend/src/models/Message.ts` (`senderType: "agent"` already in the enum), `backend/src/sockets/chat.socket.ts` (`conversation:join`/`conversation:message` handlers), `backend/src/middleware/auth.ts` (`requireAuth`, `requireRole("agent","admin")` for agent-facing endpoints).

## Extra notes (optional)

- "Sees the full conversation, including prior AI messages" is a read endpoint (`GET` messages for a conversation) — likely `GET /api/v1/conversations/:id` or a nested messages route; none exists yet (`conversation.routes.ts` only has the two `POST` stubs). Decide the route shape and note it.
- "Messages the agent sends appear instantly via WebSocket" reuses the same `conversation:message` socket event Story 14 wires for customers — an agent sending a message should go through the same persistence + broadcast path, just with `senderType: "agent"` and `senderId` set to the agent's id from `req.user`/the authenticated socket.
- This story is backend-only unless a minimal agent chat UI is judged necessary to satisfy "sees my assigned live chats" — there is no agent dashboard UI in `frontend/` yet (that's Story 20, `agent-workspace`, a later feature). If frontend work is out of reach for this story, note explicitly that only the API/socket surface is delivered here.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- Marking a conversation resolved (Story 19, separate, immediately-following story — this story only says the agent "can" do it once Story 19 exists).
- The full agent dashboard (Story 20, `agent-workspace` feature, separate, later feature).
