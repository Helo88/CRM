# Story intake

- Folder: `.squad/stories/knowledge-base/write-and-organize-help-articles/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Knowledge Base
- **Feature slug (folder under `plans/`):** `knowledge-base`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `29` *(Story 29 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `knowledge-base`

---

## Title

```
Write and organize help articles
```

---

## Description

```
As an admin, I want to write and organize longer help articles/guides, so
that customers and agents have detailed step-by-step guidance.
```

---

## Acceptance criteria

```
- Articles support rich text, images, and step-by-step formatting.
- Articles are grouped into categories/collections and show a
  last-updated date.
- Articles are available in both English and Arabic.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 28 (manage FAQs) — plans in the same feature/session should reuse whatever bilingual-content and draft/published patterns Story 28 establishes, rather than diverging.
- **Depends on code areas or other stories:** No existing article model — NEW model, e.g. `Article`. `backend/src/models/User.ts`'s `Language` type, same as Story 28.

## Extra notes (optional)

- "Rich text, images, step-by-step formatting" — storing rendered HTML or a structured format (e.g. Markdown) is a real design decision; Markdown is simpler to store/version and safer (no raw-HTML injection risk to sanitize) — recommend Markdown unless a rich-text-editor requirement is explicit elsewhere. Images: no file-upload/storage mechanism exists in this codebase yet (same gap flagged in customer-management Story 7's intake) — accept image URLs in the Markdown/content rather than building file upload here.
- "Last-updated date" — `timestamps: true` on the schema gives this for free (same as every other model in this codebase), no custom field needed.
- Categories/collections: a simple `category: string` (or a `collection` reference) is enough; don't over-build a nested taxonomy unless the acceptance criteria implies one (it doesn't).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("admin")` for write; reads open to agents and customers (articles serve both per the description).

## Out of scope

- FAQs (Story 28, separate story — shorter Q&A format vs. this story's longer-form articles).
- Search (Story 30, separate story).
- Rich file/image upload infrastructure — out of reach per Extra notes; use externally-hosted image URLs.
