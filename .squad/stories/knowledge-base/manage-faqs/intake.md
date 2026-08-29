# Story intake

- Folder: `.squad/stories/knowledge-base/manage-faqs/intake.md`

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
Manage FAQs
```

---

## Description

```
As an admin, I want to create, edit, and publish FAQs, so that customers
can find quick answers themselves.
```

---

## Acceptance criteria

```
- FAQs are organized by topic/category.
- FAQs can be draft or published; only published ones are customer-visible.
- FAQs support both English and Arabic content.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 1-3 (auth, planned) for `requireRole("admin")`.
- **Depends on code areas or other stories:** No existing FAQ/knowledge-base model — this is a NEW model. `backend/src/models/User.ts` has a `Language = "en" | "ar"` type already exported — reuse it rather than redefining English/Arabic as a new type.

## Extra notes (optional)

- Bilingual content: the model needs both languages stored per FAQ, not a separate document per language (simpler to keep in sync) — e.g. `question: { en: string; ar: string }`, `answer: { en: string; ar: string }`, following whichever pattern is cleanest given Mongoose's typing. This is the FIRST bilingual content model in the codebase — the pattern established here will likely be followed by Story 29 (help articles), which has the same requirement; keep the shape simple and reusable.
- Draft/published: a `status: "draft" | "published"` field; customer-facing read endpoints must filter `status: "published"` only, admin endpoints see both.
- No frontend exists yet for an FAQ browsing UI — this story's frontend scope (if any) is admin-side CRUD; customer-facing FAQ browsing is Story 37 (`customer-portal`, "Browse FAQs from the portal"), a separate, later story.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("admin")` for create/edit/publish; FAQ reads (published only) should be public or at least not customer-role-restricted, since any visitor should be able to browse FAQs per the feature's purpose.

## Out of scope

- Help articles (Story 29, separate story — different content type, longer-form).
- Search (Story 30, separate story).
- Customer-facing FAQ browsing UI (Story 37, `customer-portal` feature, separate, much later story).
