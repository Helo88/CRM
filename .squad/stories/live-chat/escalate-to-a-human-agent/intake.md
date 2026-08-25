# Story intake

- Folder: `.squad/stories/live-chat/escalate-to-a-human-agent/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Live Chat
- **Feature slug (folder under `plans/`):** `live-chat`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `16` *(Story 16 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `live-chat`

---

## Title

```
Escalate to a human agent
```

---

## Description

```
As a customer, I want to ask for a real person (or have the AI hand off)
when the AI can't help, so that my issue still gets resolved.
```

---

## Acceptance criteria

```
- Customer can request "talk to a human" at any point.
- Escalation flags the conversation and queues it for auto-assignment
  (Story 17).
- The human agent who joins sees the full prior AI conversation.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 14 (start a live chat), Story 15 (AI agent responds) — both planned. Story 17 (auto-assign an escalated chat) is the immediately-following story this one queues work for — this story flags/queues, Story 17 does the actual assignment.
- **Depends on code areas or other stories:** `backend/src/models/Conversation.ts` (`status: ConversationStatus = "ai_handling"|"escalated"|"with_agent"|"resolved"` — `"escalated"` already in the enum), `backend/src/sockets/chat.socket.ts`.

## Extra notes (optional)

- "Queues it for auto-assignment" — this story sets `Conversation.status = "escalated"`; Story 17 is the one that picks up escalated/queued conversations and assigns an agent. Don't implement the assignment algorithm here (see Story 17's intake for that).
- "Full prior AI conversation" is naturally satisfied by `Message` documents already being persisted per-conversation (via Story 14/15) — no extra work needed here beyond not losing/deleting anything on escalation.
- Trigger mechanism: could be an explicit customer action (e.g. a `conversation:escalate` socket event or a REST endpoint) — pick one consistent with how `conversation:message` is already handled in `chat.socket.ts`, don't introduce a second parallel transport for a very similar concern without reason.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- Actual assignment of a human agent (Story 17, separate, immediately-following story).
- Agent-side reply UI (Story 18, separate story).
