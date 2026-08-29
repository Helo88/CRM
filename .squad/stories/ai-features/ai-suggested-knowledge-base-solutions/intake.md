# Story intake

- Folder: `.squad/stories/ai-features/ai-suggested-knowledge-base-solutions/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** AI Features
- **Feature slug (folder under `plans/`):** `ai-features`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `35` *(Story 35 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ai-features`

---

## Title

```
AI-suggested knowledge-base solutions
```

---

## Description

```
As an agent, I want AI to suggest relevant knowledge-base articles for the
ticket/chat I'm working on, so that I can resolve it faster without
searching manually.
```

---

## Acceptance criteria

```
- Suggestions are ranked by relevance to the conversation's content.
- Agent can insert a suggested article/excerpt directly into a reply.
- Suggestions improve in relevance as agents accept or dismiss them over
  time.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** knowledge-base (Stories 28-30) — this story has NOTHING to suggest without FAQ/Article content and Story 30's search infrastructure existing first. This is the same class of hard dependency already noted between ai-features and knowledge-base at the feature level (`CLAUDE.md`'s build order explicitly sequences `knowledge-base` before `ai-features` specifically because of this story).
- **Depends on code areas or other stories:** `FAQ`/`Article` models (Story 28/29), Story 30's search mechanism, `backend/src/services/gemini.service.ts`.

## Extra notes (optional)

- Two possible approaches: (a) use Gemini to read the ticket/chat content and Story 30's existing text-search to find candidate KB entries, then optionally have Gemini re-rank/summarize why each is relevant; or (b) a pure embedding-based semantic search (would require a vector store, which doesn't exist in this stack — MongoDB Atlas Vector Search or a separate vector DB is out of scope for this project's stated stack). Prefer (a) — reuse Story 30's search rather than introducing new infrastructure.
- "Improve in relevance as agents accept/dismiss over time" implies a feedback-loop / learning mechanism — full ML re-ranking is out of scope for this stack; a reasonable, much simpler interpretation is tracking accept/dismiss counts per article and using that as a ranking signal/tiebreaker (a simple counter, not a trained model). State this interpretation explicitly rather than promising real ML personalization.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("agent","admin")`.

## Out of scope

- Any new vector-database/embedding infrastructure — reuse the text-search from Story 30.
- The KB content itself (Stories 28-30, separate, earlier-in-build-order feature).
