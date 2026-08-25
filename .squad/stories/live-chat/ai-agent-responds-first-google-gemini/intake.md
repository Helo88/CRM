# Story intake

- Folder: `.squad/stories/live-chat/ai-agent-responds-first-google-gemini/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Live Chat
- **Feature slug (folder under `plans/`):** `live-chat`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `15` *(Story 15 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `live-chat`

---

## Title

```
AI agent responds first (Google Gemini)
```

---

## Description

```
As a customer, I want the AI agent to try answering as soon as I send a
message, so that I get an instant response without waiting for a human.
```

---

## Acceptance criteria

```
- The message plus recent conversation history is sent to the Gemini API
  (free tier) to generate a reply.
- The reply appears in real time, clearly labeled "AI Agent."
- If the Gemini call fails or times out, the customer sees a clear fallback
  message.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 14 (start a live chat) — provides the persisted-message + Socket.io broadcast plumbing this story triggers off of.
- **Depends on code areas or other stories:** `backend/src/services/gemini.service.ts` (`generateText(prompt, { timeoutMs })` — ALREADY IMPLEMENTED: wraps the Gemini client with a 10s default timeout, returns `string | null`, never throws — this story should call this existing function, not build a new Gemini wrapper), `backend/src/models/Message.ts` (`senderType: "ai"` already in the enum), `backend/src/sockets/chat.socket.ts`.

## Extra notes (optional)

- `gemini.service.ts` already exists and is fully wired (client init from `GEMINI_API_KEY`, `generateText` with timeout + graceful `null` fallback). This story's job is to CALL it from the message-handling flow (Story 14's job to persist the customer's message; this story reacts to that by building a prompt from "the message plus recent conversation history", calling `generateText`, and persisting+broadcasting the result as a `Message` with `senderType: "ai"`).
- "Recent conversation history" needs a bounded query against `Message` (e.g. last N messages for the conversation, via the existing `messageSchema.index({ parentType: 1, parentId: 1, createdAt: 1 })`) formatted into the Gemini prompt — don't send unbounded history.
- "If the Gemini call fails or times out, the customer sees a clear fallback message" — `generateText` already returns `null` on failure/timeout rather than throwing (per CLAUDE.md's rule: "Wrap every Gemini call with a timeout and a graceful fallback message — never let a customer-facing flow hang"), so the caller just needs to check for `null` and, in that branch, persist/broadcast a system-authored fallback message (e.g. `senderType: "system"`, already in the model's enum) instead of an AI reply.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `GEMINI_MODEL` env var (default `"gemini-1.5-flash"`) is already read inside `gemini.service.ts` — don't duplicate that logic in the caller.

## Out of scope

- Escalation to a human agent when the AI can't help (Story 16, separate, immediately-following story).
- Any other Gemini-powered feature (summaries, suggested replies, auto-categorization, KB suggestions — `ai-features`, Stories 31-34, a separate, later feature) — this story is only the customer-facing chatbot's first-response behavior.
