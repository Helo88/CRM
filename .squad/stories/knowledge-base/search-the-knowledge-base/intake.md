# Story intake

- Folder: `.squad/stories/knowledge-base/search-the-knowledge-base/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Knowledge Base
- **Feature slug (folder under `plans/`):** `knowledge-base`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `31` *(Story 31 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `knowledge-base`

---

## Title

```
Search the knowledge base
```

---

## Description

```
As a customer or agent, I want to search FAQs and articles by keyword, so
that I can quickly find a relevant answer.
```

---

## Acceptance criteria

```
- Search returns ranked results across FAQs and articles.
- Search works in both Arabic and English.
- Searches with no results are logged so content gaps can be identified.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 28 (FAQs) and Story 29 (articles) — searches across both content types.
- **Depends on code areas or other stories:** The `FAQ` and `Article` models from Stories 28/29.

## Extra notes (optional)

- "Ranked results across FAQs and articles" — MongoDB's built-in text search (`$text` index) is the simplest option that doesn't require standing up a separate search service (Elasticsearch/Algolia are out of proportion for this project's scope); create text indexes on the bilingual question/title/body fields from Stories 28/29's models.
- Arabic text search: MongoDB's default text index uses language-specific stemming: 4c stopword/stemming rules per language; verify Mongoose/MongoDB's supported language list includes Arabic-appropriate handling, or fall back to a simpler substring/regex match for Arabic content if full-text stemming isn't well-supported for it — note whichever approach is chosen.
- "No-results searches are logged" needs a new small model (e.g. `SearchLog`: `query`, `language`, `resultCount`, `searchedAt`) — only logging when `resultCount === 0` per the acceptance criteria's wording ("so content gaps can be identified" implies specifically the failures, not every search).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- This endpoint should be open to both customers and agents (per the story's "As a customer or agent") — `requireAuth` only, no role restriction, similar to `ticket.routes.ts`'s `GET /` pattern.

## Out of scope

- The FAQ/article CRUD themselves (Stories 28/29, separate, earlier stories in this same feature).
- Any dedicated search-analytics dashboard — logging the data is in scope, visualizing it is not (no such story exists yet).
