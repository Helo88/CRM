# Story intake

- Folder: `.squad/stories/ai-features/ai-suggested-replies-for-agents/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** AI Features
- **Feature slug (folder under `plans/`):** `ai-features`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `32` *(Story 32 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ai-features`

---

## Title

```
AI-suggested replies for agents
```

---

## Acceptance criteria

```
- Suggestion appears as an editable draft, never sent automatically.
- Suggestion accounts for the customer's history and ticket category.
- Agent can accept, edit, or discard the suggestion.
```

---

## Description

```
As an agent, I want AI to draft a suggested reply based on the
conversation, so that I can respond faster while still reviewing before
sending.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 31 (summarize) — same underlying data access pattern (conversation/ticket messages), likely similar prompt-construction code; ticket-management/live-chat for message data; Story 6 (customer interaction history) for "customer's history" context.
- **Depends on code areas or other stories:** `backend/src/services/gemini.service.ts`, `backend/src/models/Message.ts`, `backend/src/models/Ticket.ts` (`category`).

## Extra notes (optional)

- "Never sent automatically" is a HARD requirement — the endpoint returns suggested text; it must never itself call whatever "send a reply" endpoint exists (Story 11/18). Keep this endpoint read-only/generative, with zero side effects on the ticket/conversation.
- "Accounts for the customer's history" — if Story 6's aggregation endpoint exists, this could reuse it for prompt context; if not yet built, a simpler subset (e.g. this customer's other tickets' subjects/categories) is an acceptable fallback — note which is used.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("agent","admin")`. Reuse `gemini.service.ts`.

## Out of scope

- Actually sending the reply (Stories 11/18, separate, earlier stories) — this story only drafts.
- Summarization (Story 31, separate story, though likely shares patterns).
