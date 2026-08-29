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
  message, itself labeled "AI Agent" (senderType: "ai", not "system" — see
  Extra notes; decided with the user during Story 15 kickoff).
- While the Gemini call is in flight, the customer sees an "AI Agent is
  typing…" indicator (a lightweight, non-persisted Socket.io event emitted
  right before the Gemini call, cleared when the reply/fallback message
  arrives) — decided with the user during Story 15 kickoff, not in the
  original PDF acceptance criteria but confirms the "instant response" intent.
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
- Build the prompt + history-fetch in a **new** service file, `backend/src/services/liveChatAi.service.ts` (e.g. `getAiReply(conversationId): Promise<string | null>`) — don't add chat-specific prompt logic into the shared `gemini.service.ts` wrapper, which stays a generic client (also used by the unrelated `ai-features` stories later).
- "Recent conversation history" needs a bounded query against `Message` (e.g. last ~20 messages for the conversation, via the existing `messageSchema.index({ parentType: 1, parentId: 1, createdAt: 1 })`, oldest→newest) formatted into a single prompt string (label turns as Customer/AI Agent) — don't send unbounded history, and don't change `generateText`'s signature (it already takes a plain string).
- **Trigger guard, decided with the user during kickoff:** fire the AI reply in `chat.socket.ts`'s `conversation:message` handler when `senderType === "customer" && conversation.status === "ai_handling"` — i.e., key off the existing `Conversation.status` field rather than "scan Message history for a prior AI/agent reply" (the placeholder comment left by Story 14). This is equivalent for now and is free forward-compatibility: once Story 16 (escalate) flips `status` away from `"ai_handling"`, this guard stops firing with no additional change needed.
- **Fallback message, decided with the user during kickoff:** on `generateText` returning `null` (timeout/error), persist+broadcast a `Message` with `senderType: "ai"` (not `"system"`) containing a clear, friendly fallback string (e.g. "I'm having trouble answering right now — you can try again or ask to speak with a human agent."). Rationale: it's still the AI persona speaking (just admitting it can't help), and reusing `senderType: "ai"` means the frontend needs no second bubble-styling branch beyond the "AI Agent" label already required by the first acceptance criterion.
- **Typing indicator, decided with the user during kickoff:** emit a non-persisted Socket.io event (e.g. `conversation:ai-typing`, payload `{ conversationId }`) to the conversation's room immediately before calling `getAiReply`, so the frontend can show an "AI Agent is typing…" state for however long the Gemini call takes (up to the 10s timeout). The arrival of the `conversation:message` broadcast (reply or fallback) is the primary way it clears client-side — but see the client-side safety timeout below, which is required, not optional.
- **Blank/truncated Gemini output, decided with the user during kickoff:** `generateText` only returns `null` on a thrown error or a timeout — a safety-filtered or genuinely empty completion comes back as `""` (a "success" as far as the wrapper is concerned), and a token-limit cutoff comes back as a non-empty string that just stops mid-sentence. `liveChatAi.service.ts`'s `getAiReply` must treat a blank/whitespace-only result the same as `null` (`.trim().length === 0` check) so the caller falls through to the fallback message instead of persisting an empty AI bubble. For truncation: pass an explicit `generationConfig.maxOutputTokens` (a reasonably small cap, e.g. 300) on the Gemini call so replies stay short enough to rarely hit the limit, and have the prompt itself ask for a concise reply — this reduces but does not eliminate the chance of a cut-off sentence, which is accepted as a UX rough edge, not something this story needs to fully solve.
- **DB-write failure during the AI branch, decided with the user during kickoff:** the AI branch (typing-indicator emit → `getAiReply` → `Message.create` for the reply/fallback → broadcast) must be wrapped in its own `try/catch` inside the `conversation:message` handler, separate from the customer-message persistence that precedes it (which is already covered by Story 14's own error handling). If anything in the AI branch throws (e.g. `Message.create` fails on a DB hiccup), the `catch` must still persist+broadcast the same fallback `Message` used for the `null`/blank case — otherwise the customer is left staring at "AI Agent is typing…" forever with no error ever surfaced, because an uncaught rejection in an async socket handler fails silently (it does not crash the process or emit anything to the client on its own).
- **Client-side typing-indicator safety timeout, decided with the user during kickoff:** even with the try/catch above, nothing can save a customer from a case where the *server process itself* crashes or restarts between the `conversation:ai-typing` emit and the reply (deploy, OOM, etc.) — no event can be emitted after that, by definition. `LiveChatPanel.tsx` must clear its own typing-indicator state on a client-side timeout (e.g. 15s, a few seconds past Gemini's 10s server-side timeout) independent of any server event, so a mid-flight crash doesn't leave the UI stuck on "AI Agent is typing…" indefinitely. This timeout is a required part of this story's frontend work, not a follow-up.
- **Frontend labeling:** `frontend/app/chat/LiveChatPanel.tsx` currently renders every non-customer message identically (`bg-muted`, no sender label) — add a small sender label above non-`customer` bubbles (`"AI Agent"` for `senderType: "ai"`; leave `"agent"`/`"system"` for later stories to label). New i18n key(s) go in the `Chat` section of both `frontend/messages/en.json` and `frontend/messages/ar.json` (e.g. `aiAgentLabel`, `aiTyping`).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `GEMINI_MODEL` env var (default `"gemini-1.5-flash"`) is already read inside `gemini.service.ts` — don't duplicate that logic in the caller.

## Out of scope

- Escalation to a human agent when the AI can't help (Story 16, separate, immediately-following story).
- Any other Gemini-powered feature (summaries, suggested replies, auto-categorization, KB suggestions — `ai-features`, Stories 31-34, a separate, later feature) — this story is only the customer-facing chatbot's first-response behavior.
