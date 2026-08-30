# Story intake

- Folder: `.squad/stories/live-chat/ai-agent-suggests-opening-a-ticket/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Live Chat
- **Feature slug (folder under `plans/`):** `live-chat`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `62` *(Story 62 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `live-chat`

---

## Title

```
AI agent suggests opening a ticket
```

---

## Description

```
As a customer, I want the AI agent to recognize when my issue would be
better handled as a ticket (needs a longer written follow-up, attachments,
or is otherwise beyond what live chat/AI can resolve on the spot), so that
I get pointed to the right path instead of going in circles in the chat.
```

---

## Acceptance criteria

```
- Based on the conversation's content/history, the AI can decide a ticket
  is the better path and says so directly in the chat, not just a vague
  non-answer.
- The suggestion includes a one-click action to open a ticket, pre-filled
  with a subject/description drawn from the conversation, so the customer
  doesn't have to retype their issue from scratch.
- The AI does NOT pick the category itself — accepting the suggestion
  shows the customer the same category list Story 58 manages, and the
  customer chooses/sets it themselves, same as the regular submit-ticket
  form (Story 8). This was an explicit correction from the user during
  intake: earlier phrasing left category selection ambiguous/AI-driven;
  the customer must set it, always.
- Accepting creates the ticket the same way Story 8 does, referencing the
  conversation it came from; declining just continues the chat normally.
- Same Gemini timeout/fallback handling as Story 15 — a failed AI call
  never blocks the customer from continuing to chat normally.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 15 (AI agent responds first — this story extends the same Gemini call path), Story 8 (submit a ticket — the created-ticket shape and category-selection UX this story reuses), Story 58 (manage ticket categories — the active-category list the customer picks from), Story 16 (escalate to a human — a sibling "AI decides it can't/shouldn't keep handling this itself" branch, useful as a structural reference for how a chat-embedded suggestion + one-click action is wired, though the transport differs: Story 16 is a customer-initiated socket event, this story's trigger is AI-initiated).
- **Depends on code areas or other stories:** `backend/src/services/liveChatAi.service.ts` (`getAiReply`, 47 lines — currently returns a plain string; this story needs it, or a sibling function, to also signal "suggest a ticket" alongside the reply text), `backend/src/services/gemini.service.ts` (`generateText`, the underlying Gemini client), `backend/src/sockets/chat.socket.ts` (the AI branch trigger at line 144: `if (senderType === "customer" && conversation.status === "ai_handling")`), `backend/src/models/TicketCategory.ts` + `backend/src/routes/ticketCategory.routes.ts` (`GET /api/v1/ticket-categories?active=true`, already consumed by `frontend/app/tickets/new/actions.ts`'s `listActiveTicketCategories()` — reuse, don't duplicate), `backend/src/models/Ticket.ts` (no field yet links a ticket back to the conversation it came from — this story likely needs to add one, e.g. `sourceConversation: Types.ObjectId | null`), `frontend/app/chat/LiveChatPanel.tsx` (428 lines — the chat UI Stories 14/15/16/17 already built; this story's suggestion + category picker + accept/decline action renders here), `frontend/app/chat/actions.ts` (94 lines — `createConversation`, `getMyRecentTickets`; this story likely adds a `createTicketFromConversation(...)`-shaped action here rather than trying to reuse `frontend/app/tickets/new/actions.ts`'s `submitTicket`, which is form-data/useActionState-shaped for a full page, not a chat-embedded structured call).

## Extra notes (optional)

- **How the AI signals "suggest a ticket" is an open design decision for the planner to settle, not pre-decided here:** options include (a) asking Gemini to return a small structured/tagged output (e.g. a sentinel prefix/suffix, or a second field) alongside its normal reply, parsed in `liveChatAi.service.ts`, or (b) a second, smaller Gemini call whose only job is a yes/no "should this become a ticket?" classification over the same transcript. Pick one and justify it in the plan rather than leaving it implicit — this project's existing AI integration (Story 15) is a single plain-text completion call, so whichever approach is chosen should stay consistent with "wrap every Gemini call with a timeout and a graceful fallback" (`CLAUDE.md`, AI integration).
- **The category picker is a hard requirement, not a nice-to-have:** re-render the same active-category list Story 8/58 already expose (`GET /api/v1/ticket-categories?active=true`) — do not let the AI pre-select or silently default a category beyond the same "unspecified" default Story 8's form already uses (`UNSPECIFIED_CATEGORY` in `frontend/app/tickets/new/constants.ts`).
- Pre-filled subject/description should be a reasonable summary of the conversation, not the raw transcript dumped in — likely reuses or sits next to whatever summarization approach Story 32 (`ai-features`, "Summarize a ticket or chat," a later feature) eventually builds; if Story 32 doesn't exist yet when this is planned, a simpler one-off Gemini summarization call scoped to just this story is acceptable — don't block on Story 32.
- Declining the suggestion must be a real no-op: the conversation keeps going, no ticket is created, and the AI shouldn't repeat the exact same suggestion on every subsequent message (some basic "already suggested and declined once this conversation" guard is expected — state this explicitly in the plan).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- If a new `Ticket.sourceConversation` field is added, keep it optional/nullable and unrelated to `assignedAgent`/auto-assignment (Story 10) — this is a provenance link only, not an assignment mechanism.
- Whatever transport carries the suggestion to the client (a new field on the existing `conversation:message` AI payload, vs. a new dedicated socket event) should be decided explicitly and reuse `chat.socket.ts`'s existing emit patterns rather than inventing a third mechanism alongside `conversation:message`/`conversation:escalated`/`conversation:assigned`/`conversation:no-agent-available`.

## Out of scope

- The AI auto-selecting or auto-applying a category (explicitly rejected by the user during intake — see acceptance criteria). That concept belongs to a different, later story (`ai-features` Story 34, "Automatic categorization") and must not be conflated with this one.
- Full ticket/chat summarization as a standalone feature (Story 32, `ai-features`, separate story) — this story only needs a pre-fill good enough for the customer to edit before submitting, not a polished summary product.
- Any change to Story 16's "talk to a human" escalation flow — this is a separate, parallel suggestion path, not a replacement for it.
