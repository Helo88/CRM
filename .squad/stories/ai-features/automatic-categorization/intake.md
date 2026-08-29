# Story intake

- Folder: `.squad/stories/ai-features/automatic-categorization/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** AI Features
- **Feature slug (folder under `plans/`):** `ai-features`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `34` *(Story 34 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ai-features`

---

## Title

```
Automatic categorization
```

---

## Description

```
As the system, I want AI to automatically suggest or apply a
category/priority to a new ticket or chat, so that agents don't have to
manually tag every one.
```

---

## Acceptance criteria

```
- New items receive an AI-suggested (or auto-applied, per admin config)
  category on creation.
- An agent can override the AI-assigned category at any time.
- Categorization accuracy is reviewable by an admin over time.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 8 (submit a ticket), Story 9 (categorize/prioritize a ticket) — this story automates what Story 9 made manually settable. "Per admin config" ties to Story 47 (`security-admin`), a much later feature.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`category`, `priority`), `backend/src/services/gemini.service.ts`.

## Extra notes (optional)

- "Suggested OR auto-applied, per admin config" implies a toggle that doesn't exist anywhere yet (no system-config model — same gap as Story 25's SLA targets and Story 47's eventual home). For this story, a reasonable default: hardcode one mode (e.g. always suggest, agent must confirm — the safer default) and note that a configurable toggle is deferred to Story 47, rather than building a config system just for this one flag.
- Trigger point: hook into ticket/conversation CREATION (Story 8/14's code path) to call Gemini and set/suggest a category — this is an async, best-effort enhancement, must not block or fail ticket creation if Gemini times out (same graceful-fallback rule as Story 15).
- "Categorization accuracy reviewable by an admin over time" needs to track AI-suggested vs. final category (e.g. store `aiSuggestedCategory` alongside `category` if they diverge) — a new field on `Ticket`, or a lightweight log. Note the choice.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- This is a background/async enhancement to ticket creation (Story 8) and chat start (Story 14) — coordinate insertion point carefully so it doesn't turn a synchronous 201 response into a slow one; fire-and-forget after creation (similar pattern to Story 8's fire-and-forget acknowledgment email) is a reasonable approach.

## Out of scope

- The admin-config toggle infrastructure itself (Story 47, separate, much later feature).
- Manual categorization (Story 9, separate, already-planned story) — this story only adds the AI-suggestion layer on top.
