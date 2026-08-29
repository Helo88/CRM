# Story intake

- Folder: `.squad/stories/ai-features/summarize-a-ticket-or-chat/intake.md`

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
Summarize a ticket or chat
```

---

## Description

```
As an agent, I want AI to generate a short summary of a long conversation,
so that I can get up to speed in seconds.
```

---

## Acceptance criteria

```
- A one-click "summarize" action is available on any ticket/chat with
  multiple messages.
- Summary highlights the customer's issue, what's been tried, and current
  status.
- Agent can regenerate the summary if it's inaccurate.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** ticket-management (Stories 8-13) and live-chat (Stories 14-19) for the underlying `Message` data. Depends on `backend/src/services/gemini.service.ts`'s `generateText` (already implemented, used by live-chat Story 15).
- **Depends on code areas or other stories:** `backend/src/services/gemini.service.ts` (`generateText(prompt, { timeoutMs })`), `backend/src/models/Message.ts` (query by `parentType`/`parentId`).

## Extra notes (optional)

- Reuse `gemini.service.ts`'s existing `generateText` function — do not build a second Gemini client wrapper. This is the SECOND consumer of that service (after live-chat's Story 15), which is exactly why it was factored as a shared service per CLAUDE.md's rule.
- "Regenerate" implies no caching requirement — each click can call Gemini fresh; don't over-engineer a summary-storage/versioning system unless asked.
- Prompt should exclude `internal: true` messages from being summarized as if customer-facing, OR explicitly include them as internal context — pick one and state it (likely: include all messages as context for the agent's benefit, since the summary is agent-facing, not customer-facing).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("agent","admin")`. Endpoint shape: e.g. `POST /api/v1/tickets/:id/summarize` and `POST /api/v1/conversations/:id/summarize`, or a unified endpoint — note the choice.
- Respect `gemini.service.ts`'s existing timeout/fallback contract — a failed summary should return a clear error, not hang the request (per CLAUDE.md's rule on wrapping every Gemini call).

## Out of scope

- Suggested replies (Story 32, separate story).
- Automatic categorization (Story 33, separate story).
- KB solution suggestions (Story 34, separate story).
