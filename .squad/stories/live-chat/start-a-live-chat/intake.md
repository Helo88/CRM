# Story intake

- Folder: `.squad/stories/live-chat/start-a-live-chat/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Live Chat
- **Feature slug (folder under `plans/`):** `live-chat`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `14` *(Story 14 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `live-chat`

---

## Title

```
Start a live chat
```

---

## Description

```
As a logged-in customer, I want to open a chat widget and start a new
conversation, so that I can get help right away.
```

---

## Acceptance criteria

```
- Starting a chat creates a conversation record linked to the customer.
- The conversation updates in real time over a WebSocket connection.
- The customer's first message triggers the AI agent to respond (Story 15).
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 1-3 (auth, planned) — needs `requireAuth`. Story 15 (AI agent responds) is a separate, immediately-following story — this story creates the conversation and wires Socket.io, but the actual AI-response trigger is Story 15's job (see Out of scope).
- **Depends on code areas or other stories:** `backend/src/models/Conversation.ts` (`IConversation`: `customer`, `assignedAgent`, `status` — default `"ai_handling"` — `sla`), `backend/src/models/Message.ts` (`parentType: "conversation"`, `senderType`, `text`), `backend/src/sockets/chat.socket.ts` (`registerChatHandlers` — currently a thin skeleton: `conversation:join` joins a room, `conversation:message` just re-broadcasts without persisting), `backend/src/routes/conversation.routes.ts` (`POST /` is currently a `501` stub, already wrapped in `requireAuth, requireRole("customer")`), `backend/src/server.ts` (Socket.io server setup).

## Extra notes (optional)

- Two protocols are involved: a REST `POST /api/v1/conversations` to create the `Conversation` document (the stub already exists), AND the Socket.io `conversation:join`/`conversation:message` handlers for real-time messaging (already scaffolded but not persisting anything). This story should wire the REST creation endpoint AND make `chat.socket.ts`'s `conversation:message` handler actually persist a `Message` document (currently it only re-broadcasts the payload without saving it — see the TODO comment already in that file).
- Do NOT implement the actual AI agent call in this story — `chat.socket.ts` already has a TODO marking that as Stories 14-18 collectively, but the AI invocation specifically is Story 15's acceptance criteria. This story's job is: conversation created, first message persisted, broadcast works. Triggering `gemini.service.ts`'s `generateText` is Story 15.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("customer")` for `POST /api/v1/conversations`.
- Socket.io connection itself doesn't carry Express auth middleware — the socket handlers need their own way to know which authenticated customer is sending a `conversation:message` (e.g. validate the conversation's `customer` field matches the sender, or authenticate the socket connection itself via a token in the handshake). Flag whichever approach is chosen explicitly.

## Out of scope

- AI agent response generation (Story 15, separate, immediately-following story).
- Escalation to a human agent (Story 16, separate story).
- Agent-side reply UI (Story 18, separate story).
