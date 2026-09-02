# Story 30 — Write and organize help articles (Story: 30)

> **Hand-authored plan**, same as `29-story-manage-faqs.md` — squad-kit's generator was
> deliberately not used for this feature. Requirements source:
> `.squad/stories/knowledge-base/write-and-organize-help-articles/intake.md`.

> **AMENDMENT (2026-09-02)** — see Story 29's plan for the full reasoning; the same
> three changes apply here, carried over exactly:
> 1. **No draft/published state.** No `status`/`publishedAt` on `HelpArticle`, no
>    `kb:publish` (removed, not reused). `kb:article_create`/`kb:article_edit` gate
>    every write; `PATCH /kb/articles/:id` is one `requirePermission("kb:article_edit")`.
> 2. **Add/edit is a dialog** (`ArticleDialog.tsx`), not `/admin/kb/articles/new` or
>    `[id]/edit` — same trigger pattern as `FaqDialog`. The dialog fetches the full
>    record (incl. both bodies) on open, since the list response omits `body`.
> 3. **The admin list is a plain table** — title (EN/AR) + category + updated + actions
>    only, no body/summary preview — not the richer column set in Task 13 below.
>
> Markdown-via-`react-markdown`-without-`rehype-raw` (Design decision 2), the slug
> design (Decision 4), and the AI assists all held up and were implemented as written.

## Prerequisites

- **Story 29 (Manage FAQs) must be complete first.** This story is a deliberate near-clone of it
  and reuses, unchanged: `backend/src/models/localizedText.ts` (`ILocalizedText`,
  `localizedTextSchema`, `hasBothLanguages`), `backend/src/constants/kb.ts`
  (`KB_CATEGORY_SLUGS`, `KB_STATUSES`), the draft/published + `publishedAt` + `isDeleted` shape,
  the service-choke-point discipline, `services/kbAi.service.ts`, `hasAnyPermission` in
  `services/permissions.ts`, `frontend/lib/kb.ts`, `frontend/lib/localized.ts`
  (`pickLocalized`), the `KbCategories` i18n section, and the `BilingualFieldEditor` component.
  **If any of those look wrong while building this story, fix them in place and re-verify Story 29
  — do not fork a parallel version.**
- `backend/src/routes/kbPublic.routes.ts` already exists (Story 29) with the FAQ endpoint. This
  story **adds** the article endpoints to that same file, for the same reason it was created as its
  own router: the "never leak a draft" invariant stays in one small unauthenticated file.
- `backend/src/constants/permissions.ts` already contains the `kb:faq_*` block and the shared
  `kb:publish`. This story adds the `kb:article_*` half.
- **`frontend/components/ui/` has no `accordion`, and no Markdown renderer is installed anywhere.**
  This story adds a Markdown dependency (see Design decision 2); the accordion is Story 31's
  problem, not this one's.

---

## Story Goal

1. An admin (or a sub-admin holding the matching granular `kb:article_*` key) can **write, organize,
   publish/unpublish, and delete long-form help articles** from a real admin UI. Admin/sub-admin
   territory only — these keys join `SUBADMIN_ONLY_PERMISSIONS` alongside `kb:faq_*`, so an agent
   account can never hold them.
2. Articles support **rich text, images, and step-by-step formatting** — via **Markdown**, stored
   per language (Design decision 2).
3. Articles are **grouped into categories** (the same shared KB vocabulary as FAQs) and show a
   **last-updated date** (`timestamps: true`'s `updatedAt` — no custom field, per the intake).
4. Articles are **bilingual** — `title`, `summary`, and `body` each hold `{ en, ar }` in one
   document; publishing requires both languages on all three, exactly as for FAQs.
5. The same two **narrow, optional, non-blocking Gemini assists** as Story 29: draft-translate
   (per field, including the long Markdown body) and duplicate-flag on newly created drafts.
6. The **public, published-only** article endpoints Story 31's browse and detail pages consume.

**Out of scope:**

- **FAQs** — Story 29.
- **Knowledge-base keyword search** — `USER_STORIES.md` Story 31 (ranked, bilingual, no-result
  logging). The admin list here gets the standard `?q=` substring filter; that is a list filter, not
  the search feature.
- **Agent-facing AI-suggested KB solutions** — Story 35 (`ai-features`). Nothing here ranks content
  against a live ticket or chat, and no accept/dismiss feedback loop is built.
- **File/image upload infrastructure** — none exists for content (customer attachments use a
  different, protected, per-customer route). Per the intake: **accept externally-hosted image URLs
  inside the Markdown**; do not build an uploader. See Design decision 3.
- **A WYSIWYG rich-text editor.** Markdown + live preview, justified below.
- **Notifications and global quick-search entries for KB admin actions** — see "Deliberate
  exclusions".
- **A generic system-wide audit log** — see "Future audit log".
- **Article versioning / revision history.** No acceptance criterion asks for it, and the future
  system-wide audit log is the natural home for "who changed what when". Noted so it isn't
  half-built here.

---

## Context — Read These Files First

1. **`.squad/plans/knowledge-base/29-story-manage-faqs.md` — the whole file.** This plan is
   deliberately terse wherever Story 29 already spelled something out; every "same as Story 29"
   below points at a section there. Read it first or this plan will look underspecified.
2. `backend/src/models/Faq.ts`, `backend/src/services/faq.service.ts`,
   `backend/src/routes/kbFaq.routes.ts`, `backend/src/validation/kbFaq.schema.ts` — as built by
   Story 29. `HelpArticle` mirrors all four, with the differences listed below.
3. `backend/src/models/localizedText.ts` and `backend/src/constants/kb.ts` — reused as-is; this
   story only adds article-specific length constants to the latter.
4. `backend/src/services/kbAi.service.ts` — `suggestTranslation` gains a `"title" | "summary" |
   "body"` kind; `findSimilarPublishedArticles` is added alongside the FAQ version.
5. `frontend/app/admin/kb/faqs/` — the whole directory. `page.tsx`, `FaqFilterBar.tsx`,
   `RowActions.tsx`, `ConfirmActionButton.tsx`, `actions.ts`, `BilingualFieldEditor.tsx`, `new/`,
   `[id]/edit/`. The article pages are the same structures with a different resource.
6. `backend/src/models/TicketCategory.ts` lines 35–40 — the **collation-based case-insensitive
   unique index** pattern, and `ticketCategory.routes.ts`'s `findByNameCaseInsensitive` — reused
   here for the article **slug** uniqueness check.
7. `backend/src/routes/kbPublic.routes.ts` — extended, not replaced.
8. `frontend/lib/staffNav.ts`, `frontend/components/HeaderSearch.tsx` — same two-surface
   distinction as Story 29 (`STAFF_NAV_ITEMS` yes, `STAFF_ACTION_ITEMS` no, `PAGE_SEARCH_TARGETS`
   yes).
9. `CLAUDE.md` → "Dependency freshness policy". This story adds the **only new npm dependency in
   the whole knowledge-base feature**; that policy is mandatory, not advisory.

---

## Design decision 1 — permission keys

**Adds four keys; reuses the shared `kb:publish` from Story 29.**

| Key | Gates |
|---|---|
| `kb:article_view_list` | `GET /kb/articles`, `GET /kb/articles/:id`, the `/admin/kb/articles` page |
| `kb:article_create` | `POST /kb/articles` |
| `kb:article_edit` | `PATCH /kb/articles/:id` when content fields change |
| `kb:article_delete` | `DELETE /kb/articles/:id` |
| `kb:publish` *(existing)* | `PATCH /kb/articles/:id` when `status` changes |

Same reasoning as Story 29's "Design decision 2", which should be read rather than restated: per
**entity** for CRUD (curating short Q&A pairs and writing long-form documentation are separately
delegable jobs — an account can hold `kb:faq_*` without `kb:article_*` and vice versa), one shared
key for **publish** (a single editorial "this is now customer-visible in both languages" authority,
already reserved, already labelled, already in `SUBADMIN_ONLY_PERMISSIONS`). All four new keys join
`SUBADMIN_ONLY_PERMISSIONS`; `DEFAULT_PERMISSIONS_BY_ROLE` is untouched.

The same two non-negotiable enforcement rules carry over:

- **`POST /kb/articles` always creates a draft** and does not accept a `status` field — otherwise
  `kb:article_create` becomes a back door around `kb:publish`.
- **`PATCH` checks keys per changed field inside the handler** (content → `kb:article_edit`,
  `status` → `kb:publish`), the `ticketCategory.routes.ts` pattern, with both checks running before
  any mutation so a mixed request is rejected whole.
- The frontend **hides** controls the viewer's permissions don't cover.

---

## Design decision 2 — Markdown for the body (and the one new dependency)

The acceptance criterion is "rich text, images, and step-by-step formatting". Three options were on
the table; the intake already leans to the second and it is the right call:

| Option | Verdict |
|---|---|
| Store rendered **HTML** from a WYSIWYG editor | **No.** Every render becomes an XSS surface needing sanitisation on the way out to a *public, unauthenticated* page; it drags in a heavy editor dependency; and it stores a format that's painful to diff or migrate. |
| Store **Markdown** | **Yes.** Covers headings, ordered lists (step-by-step), emphasis, links, tables, code, and images natively; is plain text (diffable, greppable, trivially bilingual); needs no editor library — a `Textarea` plus a preview tab; and is safe by construction with the right renderer (below). |
| A structured **block model** (JSON blocks) | **No.** More faithful long-term, far more work, and nothing in the acceptance criteria needs it. |

**Rendering, and the security rule that comes with it:** add **`react-markdown`** plus
**`remark-gfm`** (tables, strikethrough, task lists) to `frontend/`. `react-markdown` **does not
render raw HTML** unless `rehype-raw` is explicitly added.

> **Do not add `rehype-raw`, and do not pass `rehype-raw` to any `ReactMarkdown` in this codebase.**
> Without it, an admin embedding `<script>` (or anything else) in a body has it rendered as inert
> text, and the public article page has no HTML-injection surface at all — no sanitiser to
> configure, keep updated, or get wrong. If raw HTML in articles is ever genuinely needed, that is a
> deliberate story with a sanitisation design, not a one-line plugin addition.

**Dependency-freshness procedure is mandatory** (`CLAUDE.md`): before installing, run
`npm view react-markdown version`, `npm view remark-gfm version`, and
`npm view <pkg> dist-tags --json` for each to confirm you are reading `latest` and not a
`next`/`rc`/`beta` tag; then `npm view <pkg>@<version> peerDependencies engines --json` and
cross-check against the installed React 19 / Next 16 and `node --version` (currently 20.15.0 — see
the mongoose pinned exception in `CLAUDE.md`). If the newest major needs a higher Node than what's
installed, **pin to the newest compatible version and record the tradeoff** in `CLAUDE.md`'s
"Current pinned exceptions" rather than forcing the upgrade. After installing, `npm run build` in
`frontend/` must pass before the story continues.

**Authoring UX:** a `Tabs` pair for **English / العربية** (the existing `BilingualFieldEditor`
shape), and inside each language a second `Tabs` pair for **Write / Preview** — the Write pane is a
tall controlled `Textarea` (`font-mono`, `dir` set per language), the Preview pane renders the same
string through the shared `ArticleBody` component the public page uses, so what the admin previews
is exactly what a customer gets. No editor library, no toolbar. A short Markdown cheat-sheet line
under the textarea (`t("markdownHint")`) covers `## heading`, `1.` steps, `![alt](url)`.

---

## Design decision 3 — images

No content file-upload mechanism exists in this codebase (the customer attachment routes are
protected, per-customer, and not a general asset store), and building one is out of scope per the
intake. **Articles reference externally-hosted images via ordinary Markdown `![alt](https://…)`.**

Two rules the implementation must enforce:

- **`alt` text is required by convention and prompted for in the UI** (the cheat-sheet line shows
  `![alt](url)` with the alt filled in), because the public article page is a real SEO surface —
  `CLAUDE.md`'s SEO section requires `alt` on every image.
- The `ArticleBody` renderer maps Markdown images to a component that applies
  `max-width: 100%`, `height: auto`, `loading="lazy"`, and **renders nothing when `alt` is
  missing-and-`src` is empty** rather than a broken-image box. Do **not** use `next/image` — the
  hosts are arbitrary and unknown, so `next.config.js`'s `images.remotePatterns` cannot be
  enumerated; a plain `<img>` is correct here. Note that in a comment so nobody "upgrades" it.

Flagged for the user: an admin with no image host has no way to add a picture. See Open questions.

---

## Design decision 4 — the slug

Articles need a stable, shareable URL for their public detail page (`/help/<slug>`, Story 31).

- **One slug per article, language-neutral, not one per language.** This app has **no `[locale]`
  routing segment** (`CLAUDE.md`, i18n section: locale comes from a cookie) — so a per-language
  slug would mean the same article lives at two URLs whose content flips with a cookie, which is an
  SEO duplicate-content problem and a link-sharing footgun. One URL, content rendered in the
  viewer's language.
- **Generated from the English title** (kebab-case, ASCII, `[a-z0-9-]`, collapse repeats, trim
  dashes, max 120 chars) as a *default*, then **editable** in the form, then **uniqueness-checked
  case-insensitively** using the collation pattern from `TicketCategory` — including against
  soft-deleted articles, so a deleted slug isn't silently reused and old links resurrected pointing
  at different content.
- **If the English title is empty** (an Arabic-first draft), fall back to a transliteration-free
  `article-<short id>` and let the admin edit it. Do not attempt Arabic-to-Latin transliteration —
  that is a whole problem domain, and the slug is editable anyway.
- **Changing the slug of a published article breaks its existing links.** The form warns
  (`t("slugChangeWarning")`) when editing the slug of a published article. No redirect table is
  built — flagged in Open questions.

---

## Backend Tasks

### 1 — Permission keys

**File: `backend/src/constants/permissions.ts`** — add to `PERMISSION_KEYS`, immediately after the
`kb:faq_*` block, and to `SUBADMIN_ONLY_PERMISSIONS`:

```ts
// knowledge-base Story 30: long-form help articles. Deliberately a separate
// key family from kb:faq_* — see Story 30's plan, "Design decision 1".
// Publishing stays on the shared kb:publish key above.
"kb:article_view_list",
"kb:article_create",
"kb:article_edit",
"kb:article_delete",
```

**File: `frontend/lib/permissions.ts`** — add the same four to the `kb` category array and the
frontend `SUBADMIN_ONLY_PERMISSIONS` set (keep it a mirror of the backend, in the same change).

**Files: `frontend/messages/{en,ar}.json`** — `Permissions.keys` gains:
`"kb:article_view_list": "View the help article list"`, `"kb:article_create": "Add help articles"`,
`"kb:article_edit": "Edit help articles"`, `"kb:article_delete": "Delete help articles"`.

### 2 — KB constants

**File: `backend/src/constants/kb.ts`** — append:

```ts
export const ARTICLE_TITLE_MAX_LENGTH = 200;
export const ARTICLE_SUMMARY_MAX_LENGTH = 400;
// Generous, but bounded — an unbounded body is an unbounded request payload
// and an unbounded render on a public page.
export const ARTICLE_BODY_MAX_LENGTH = 50_000;
export const ARTICLE_SLUG_MAX_LENGTH = 120;
export const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
```

### 3 — The `HelpArticle` model

**New file: `backend/src/models/HelpArticle.ts`** — mirrors `Faq.ts` (read it first) with these
differences:

```ts
export interface IHelpArticle extends Document {
  /** Language-neutral, URL-stable, unique case-insensitively. See the plan's Design decision 4. */
  slug: string;
  title: ILocalizedText;
  /** Short excerpt: list cards, and the public detail page's SEO meta description. */
  summary: ILocalizedText;
  /** MARKDOWN, per language. Rendered with react-markdown WITHOUT rehype-raw — see Design decision 2. */
  body: ILocalizedText;
  category: KbCategorySlug;
  status: KbStatus;
  publishedAt: Date | null;
  isDeleted: boolean;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  /** The acceptance criteria's "last-updated date" — from timestamps: true, no custom field. */
  updatedAt: Date;
}
```

Schema notes:

- `slug: { type: String, required: true, trim: true, lowercase: true, maxlength: ARTICLE_SLUG_MAX_LENGTH, match: ARTICLE_SLUG_PATTERN }`.
- `helpArticleSchema.index({ slug: 1 }, { unique: true, collation: { locale: "en", strength: 2 } })`
  — copied from `TicketCategory.ts` lines 35–40, **including soft-deleted rows** on purpose (see
  Design decision 4). Handlers must query with the same collation.
- `helpArticleSchema.index({ status: 1, isDeleted: 1, category: 1, updatedAt: -1 })` — the public
  browse query.
- `title`/`summary`/`body` via `localizedTextSchema(<max>)`, all three `required: true` as
  subdocuments (individual language strings default to `""`, same as FAQs).
- Docblock must state: same bilingual/draft/soft-delete reasoning as `Faq.ts` (cross-reference it),
  body is Markdown, `updatedAt` is the story's "last-updated date".

### 4 — Validation

**New file: `backend/src/validation/kbHelpArticle.schema.ts`** — mirrors `kbFaq.schema.ts`:

- `articleIdParamsSchema`, `articleSlugParamsSchema`
  (`z.string().trim().toLowerCase().regex(ARTICLE_SLUG_PATTERN).max(ARTICLE_SLUG_MAX_LENGTH)`).
- `createHelpArticleBodySchema`: `title`, `summary`, `body` (each the shared localized-text schema
  with its own max, refined to "at least one language"), `category`, and **optional `slug`** (when
  omitted the service generates one). **No `status`.**
- `updateHelpArticleBodySchema`: all of the above optional, plus `status`, refined to reject an
  empty body.
- `listHelpArticlesQuerySchema` — `paginationQuerySchema` + `q`, `category`, `status`, `sort`
  (`ALLOWED_ARTICLE_SORT_KEYS = ["updatedAt", "createdAt", "publishedAt"]`).
- `listPublicHelpArticlesQuerySchema` — `paginationQuerySchema` + optional `category`. **No
  `status`.**
- `translateArticleFieldBodySchema` — same shape as the FAQ version with
  `field: z.enum(["title", "summary", "body"])` and `text` capped at `ARTICLE_BODY_MAX_LENGTH`.

### 5 — `helpArticle.service.ts` — the mutation choke point

**New file: `backend/src/services/helpArticle.service.ts`**, mirroring `faq.service.ts` exactly:
`createHelpArticle`, `updateHelpArticle`, `softDeleteHelpArticle`, all taking `actorId`, all the
only write path to the collection. Route handlers never touch `HelpArticle` for a write. (Reason —
one place for the publish rule, and a one-line hook for the future audit log; see "Future audit
log".)

Article-specific responsibilities:

- **`slugify(title.en)`** helper (kept local to this service): lowercase, strip diacritics via
  `String.prototype.normalize("NFKD")` + combining-mark removal, replace non-`[a-z0-9]` with `-`,
  collapse and trim dashes, truncate to `ARTICLE_SLUG_MAX_LENGTH`. Empty result → `article-<8 hex
  chars>`.
- **`findBySlugCaseInsensitive(slug, excludeId?)`** using `.collation({ locale: "en", strength: 2 })`,
  mirroring `ticketCategory.routes.ts`'s `findByNameCaseInsensitive`. On create, if the generated
  slug is taken, append `-2`, `-3`, … until free (bounded, e.g. 20 attempts, then fall back to
  `article-<hex>`). On an **explicit** slug collision — create or edit — throw
  `HelpArticleValidationError("An article with that URL slug already exists")` → 400, so the admin
  sees the conflict rather than silently getting a different URL than they typed.
- **`assertPublishable`**: `hasBothLanguages` must hold for **`title`, `summary`, and `body`**.
  Message: "A help article must have both English and Arabic title, summary and body before it can
  be published." Runs whenever the *resulting* document would be published — a `draft → published`
  transition **and** any content edit to an already-published article.
- `publishedAt` stamped on first publish only; kept on unpublish/republish.
- `E11000` from the unique slug index caught and mapped to the same 400, in case of a race.

### 6 — `kbAi.service.ts` extensions

**File: `backend/src/services/kbAi.service.ts`** (created by Story 29):

- Widen `suggestTranslation`'s `kind` to `"question" | "answer" | "title" | "summary" | "body"`.
  For `"body"` the prompt must say: **the input is Markdown; preserve the Markdown structure
  exactly** (headings, list numbering, links, image `src`s and code blocks unchanged); translate
  only the prose; return only the translated Markdown with no fence around the whole document.
  Post-processing still strips a wrapping fence if one appears anyway, and returns `null` if the
  result exceeds `ARTICLE_BODY_MAX_LENGTH`.
- Body translation is a large prompt: use a longer timeout for `kind === "body"` (e.g. 20s) with a
  comment saying why the FAQ-field 8s budget doesn't apply — and note that the *admin still isn't
  blocked*, since the assist is optional and the form stays usable while it runs.
- Add `findSimilarPublishedArticles({ title, summary, excludeId })` — the identical two-stage
  design (cheap `escapeRegex` DB shortlist over `title.en`/`title.ar`/`summary.*` of published,
  non-deleted articles capped at 20; **skip Gemini entirely on an empty shortlist**; one call;
  `[]` on `null`/unparseable output; **drop any returned id not in the shortlist**).
  Deliberately matches on title/summary, not body: comparing 50KB documents is neither cheap nor
  more accurate for "is this the same guide".

### 7 — `kbHelpArticle.routes.ts` (admin surface)

**New file: `backend/src/routes/kbHelpArticle.routes.ts`**, mounted at `/api/v1/kb/articles`.
Structurally identical to `kbFaq.routes.ts` — same local `callerHasPermission` /
`callerHasAnyPermission` helpers, same `{ items, total, page, limit }` envelope.

| Method + path | Middleware | Notes |
|---|---|---|
| `GET /` | `requirePermission("kb:article_view_list")` | `q` searches `title.{en,ar}` and `summary.{en,ar}` via `escapeRegex` — **not `body`**: a substring match inside a 50KB Markdown document produces useless hits for an admin scanning a list, and ranked full-content search is Story 31's job. Default sort `{ updatedAt: -1 }`. Response envelope key: `articles`. |
| `GET /:id` | `requirePermission("kb:article_view_list")` | Full document including both bodies; prefills the edit form. 404 when missing/deleted. |
| `POST /` | `requirePermission("kb:article_create")` | Always a draft. 201. |
| `PATCH /:id` | none route-level | Per-field: `title`/`summary`/`body`/`category`/`slug` → `kb:article_edit`; `status` → `kb:publish`. Both checks before any mutation. `HelpArticleValidationError` → 400. |
| `DELETE /:id` | `requirePermission("kb:article_delete")` | Soft delete → 200 `{ id, deleted: true }`; 404 if already gone. |
| `POST /ai/translate` | `callerHasAnyPermission(["kb:article_create", "kb:article_edit"])` | **Always 200**, `{ translation: string \| null }`. |
| `GET /:id/ai/duplicates` | `requirePermission("kb:article_view_list")` | **Always 200**, `{ duplicates: [...] }`, possibly empty. |

The response serializer returns both languages for all three fields, plus `slug`, `category`,
`status`, `publishedAt`, `createdAt`, `updatedAt`. The **list** serializer omits `body` — sending
two 50KB bodies per row for a 10-row page is pointless payload; the edit page fetches the full
document by id. (State this in a code comment so nobody "fixes" the asymmetry.)

### 8 — Public article endpoints

**File: `backend/src/routes/kbPublic.routes.ts`** (extend; keep its existing header comment about
why this router exists and never relax the hardcoded filter):

| Method + path | Behaviour |
|---|---|
| `GET /articles` | `listPublicHelpArticlesQuerySchema`. `{ status: "published", isDeleted: { $ne: true }, ...category }`, sort `{ updatedAt: -1 }` (freshest guidance first). Returns `{ id, slug, title: { en, ar }, summary: { en, ar }, category, updatedAt }` — **no `body`** (list payload), no `status`, no `publishedAt`, no `createdBy`/`updatedBy`. |
| `GET /articles/:slug` | `validateParams(articleSlugParamsSchema)`. Same hardcoded published filter, looked up **with the collation** so a mixed-case URL still resolves. Returns the full document including `body: { en, ar }`. 404 for a draft, a soft-deleted article, or an unknown slug — all three identical, so a draft's existence isn't discoverable by URL guessing. |

Both endpoints return **both languages** for the same reason as Story 29's FAQ endpoint: the
frontend resolves the locale server-side from the cookie, the response stays locale-agnostic and
cacheable, and the language toggle needs no refetch.

### 9 — Mount

**File: `backend/src/app.ts`** — `app.use("/api/v1/kb/articles", kbHelpArticleRoutes);` alongside
the Story 29 mounts. (`knowledge-base` was already removed from the TODO comment by Story 29.)

---

## Frontend Tasks

Same conventions as Story 29 throughout: authenticated pages get
`robots: { index: false, follow: false }`; every mutation is a Server Action with `zod` validation
**inside** it returning per-field errors; every input is **controlled**; every new string lands in
**both** message files; shadcn primitives only; theme tokens only.

### 10 — Dependency install

From `frontend/`, following the freshness procedure in Design decision 2:
`npm i react-markdown@<checked> remark-gfm@<checked>`. **Do not install `rehype-raw`.**
Then `npm run build` before writing any UI that depends on it.

### 11 — `ArticleBody` — the one shared Markdown renderer

**New file: `frontend/components/ArticleBody.tsx`**

```tsx
// The ONE place help-article Markdown is rendered — used by the admin
// preview pane (Story 30) and the public article page (Story 31), so an
// admin's preview is byte-for-byte what a customer sees.
//
// SECURITY: no rehype-raw, deliberately. react-markdown renders raw HTML
// inside the source as inert text unless that plugin is added, which means
// this component has no HTML-injection surface at all and needs no
// sanitiser. Do not add rehype-raw here or anywhere else. See
// .squad/plans/knowledge-base/30-story-write-and-organize-help-articles.md,
// "Design decision 2".
```

- Props: `{ markdown: string; lang: Locale }`. Sets `lang` and `dir` on its wrapper from `lang`, so
  Arabic content inside an English-chrome page renders RTL (and vice versa).
- Plugins: `remarkGfm` only.
- Component overrides for every element the design system should own — headings (`h2`/`h3` with
  the app's tracking/weight), `p`, `ul`/`ol` (`ol` styled so numbered steps read as steps: markers
  visible, comfortable spacing — this is what satisfies "step-by-step formatting"), `a`
  (`text-primary underline underline-offset-4`, plus `target="_blank" rel="noreferrer noopener"`
  for external links), `code`/`pre` (`bg-muted`, `overflow-x-auto`), `blockquote`, `table` wrapped
  in an **`overflow-x-auto`** container, and `img` per Design decision 3 (plain `<img>`,
  `max-w-full h-auto rounded-lg`, `loading="lazy"`, `alt` passed through).
- **Theme tokens only** — no hex. Must be legible in both light and dark.

### 12 — Nav entry

**File: `frontend/lib/staffNav.ts`** — add to `STAFF_NAV_ITEMS`:

```ts
{ key: "kbArticles", href: "/admin/kb/articles", icon: BookOpen, staffOnly: true, agentOrAdminOnly: false, permission: "kb:article_view_list" },
```

placed directly after Story 29's `kbFaqs` entry. `Nav.kbArticles` = "Help articles" in both message
files. **Nothing added to `STAFF_ACTION_ITEMS`** — see "Deliberate exclusions".

### 13 — Article list page

**New files: `frontend/app/admin/kb/articles/page.tsx`** and **`ArticleFilterBar.tsx`** — direct
adaptations of `frontend/app/admin/kb/faqs/page.tsx` / `FaqFilterBar.tsx`:

- Same session/refresh/403 handling, same `currentQuery` → **every param forwarded to the backend
  fetch**, same `ListPagination`, same mobile-cards / desktop-table split.
- Permission flags: `canCreate`/`canEdit`/`canDelete` from `kb:article_*`, `canPublish` from
  `kb:publish`; `showActionsColumn` is their union; controls **hidden**, not disabled.
- Columns: **Title** (viewer's locale via `pickLocalized`, with the `slug` beneath it in
  `font-mono text-xs text-muted-foreground` — the slug is the shareable URL, admins will want it
  visible), **Languages** (`EN`/`AR` badges — filled only when **all three** fields have that
  language, since partial translation is exactly what blocks publishing), **Category**, **Status**,
  **Last updated** (the acceptance criterion's date — label it "Last updated", not "Updated"), and
  **Actions**.
- Filter bar: Category, Status, Sort (`-updatedAt` / `updatedAt` / `-publishedAt` / `-createdAt`),
  the clearable `q` chip, and the reset button in its own row, `ghost` + `text-destructive`.

**File: `frontend/components/HeaderSearch.tsx`** — add
`"/admin/kb/articles": "searchArticlesFor"` to `PAGE_SEARCH_TARGETS`, plus the `Nav.searchArticlesFor`
message in both files.

### 14 — Row actions + Server Actions

**New files: `frontend/app/admin/kb/articles/ConfirmActionButton.tsx`** (a route-local copy, same
colocation convention the existing copies document — do **not** consolidate the now-four copies),
**`RowActions.tsx`**, and **`actions.ts`**.

`RowActions` adds one thing the FAQ version doesn't have: when `status === "published"`, a
**"View"** link (`ExternalLink` icon) to `/help/${slug}` — the live public page (Story 31). Before
Story 31 ships, that link 404s; gate it behind Story 31 or ship it in Story 31's change, whichever
lands second. Note the ordering in a comment.

`actions.ts` mirrors the FAQ actions file exactly: `getBearerToken` → `refreshSession` fallback,
retry-once on 401, `mapBackendError`, `{ error, fieldErrors }` state, and
`createArticleAction` / `updateArticleAction` / `publishArticle` / `unpublishArticle` /
`deleteArticle` / `translateArticleField` / `checkArticleDuplicates`. Every mutating action
`revalidatePath("/admin/kb/articles")` **and** `revalidatePath("/help")`, and the ones that can
change a published article also `revalidatePath(\`/help/${slug}\`)` — Story 31's public pages are
`revalidate`-cached, so a publish or edit must invalidate them. Backend errors needing their own
translated message: `errorNeedsBothLanguages`, `errorSlugTaken`.

### 15 — Create / edit forms

**New files:** `frontend/app/admin/kb/articles/new/page.tsx` + `NewArticleForm.tsx`, and
`frontend/app/admin/kb/articles/[id]/edit/page.tsx` + `EditArticleForm.tsx`.

Reuse `BilingualFieldEditor` (Story 29) for **title** and **summary**. For the **body**, add:

**New file: `frontend/app/admin/kb/articles/BilingualMarkdownEditor.tsx`** (Client Component) —
the `BilingualFieldEditor` pattern with a nested **Write / Preview** `Tabs` inside each language
pane:

- Write: a tall controlled `Textarea`, `font-mono text-sm`, `dir`/`lang` set for the pane's
  language, with the `t("markdownHint")` cheat-sheet line under it.
- Preview: `<ArticleBody markdown={value} lang={paneLanguage} />` — the same component the public
  page uses, inside a bordered card so the preview boundary is obvious.
- The same **"Draft translation with AI"** button per language, `useTransition` →
  `translateArticleField(...)`; a string result lands in the empty pane as ordinary editable text
  with the dismissible `t("aiDraftNotice")` ("Machine-drafted. Review before publishing."); a
  `null` result shows the quiet muted `t("aiUnavailable")` line — **no error styling, no retry
  loop, no blocked submit**. Body translation can take ~20s: show a pending state on the button
  only, and **leave the rest of the form fully interactive** while it runs.

`NewArticleForm`: controlled state for `titleEn/Ar`, `summaryEn/Ar`, `bodyEn/Ar`, `category`, and
`slug` (with a **"generated from the English title unless you change it"** hint and a live preview
of the resulting `/help/<slug>` URL). Submit reads **"Save as draft"**. On success, run
`checkArticleDuplicates(newId)` and route to the edit page.

`EditArticleForm`: prefilled; plus the status line and **Publish/Unpublish** (`canPublish` only),
**disabled with an explanatory hint** while any of title/summary/body is missing a language (the
client-side mirror of `assertPublishable`; the server remains the real boundary); plus the
`t("slugChangeWarning")` shown when the slug field is edited on a **published** article; plus the
non-blocking duplicate `Alert` (warning tokens, never `destructive`, dismissible, renders nothing
on an empty result so a Gemini outage is invisible) and a **"Check for duplicates"** button.

### 16 — i18n

**Both `frontend/messages/en.json` and `ar.json`, in the same change.** New sections, placed with
the other KB sections:

- `AdminArticles` — `heading`, `addArticle`, `colTitle`, `colLanguages`, `colCategory`, `colStatus`,
  `colLastUpdated`, `colActions`, `statusDraft`, `statusPublished`, `viewPublic`, `filter*`,
  `searchingFor`, `resetFilters`, `sort*`, `empty`, `edit`, `publish`/`publishConfirm*`,
  `unpublish`/`unpublishConfirm*`, `delete`/`deleteConfirm*`, `noAccess`, `genericError`,
  `errorNeedsBothLanguages`, `errorSlugTaken`.
- `ArticleForm` — `newHeading`, `editHeading`, `title`, `summary`, `body`, `slug`, `slugHint`,
  `slugPreview`, `slugChangeWarning`, `category`, `tabEnglish`, `tabArabic`, `tabWrite`,
  `tabPreview`, `markdownHint`, `saveDraft`, `saveChanges`, `saving`, `publish`, `unpublish`,
  `publishNeedsBothLanguages`, `aiTranslate`, `aiTranslating`, `aiDraftNotice`, `aiUnavailable`,
  `duplicateWarningTitle`, `duplicateWarningBody`, `checkDuplicates`, `dismiss`, and per-field
  validation messages.
- `Nav` additions: `kbArticles`, `searchArticlesFor`.
- `Permissions.keys` additions: the four new keys (Task 1).

`KbCategories` already exists from Story 29 — reuse it, don't duplicate.

---

## Deliberate exclusions — notifications and global search

**Identical to Story 29's decision, and made by the user for the same reason. Do not "fix" either
without asking.** Story 29's plan carries the full reasoning; the short version:

- **No in-app notification** fires when an article is created, edited, published, unpublished, or
  deleted. No new `NotificationType`, no import of `notification.service.ts` in
  `helpArticle.service.ts`, nothing written to the `Notification` collection. The bell exists to
  tell a specific person that something now needs their attention; nobody is waiting on an
  individual article, and turning the bell into a content changelog would dilute the events that
  do need a response.
- **Nothing is added to `STAFF_ACTION_ITEMS`** in `frontend/lib/staffNav.ts` — there is no
  "New help article" ⌘K quick action. Writing a guide is deliberate, planned work, not something
  dashed off mid-ticket.
- **The unused `cmdk` `frontend/components/ui/command.tsx` primitive stays unused**, and if a real
  global command palette is ever built, KB admin actions must **not** be indexed into it.
- **What *is* added:** one `STAFF_NAV_ITEMS` **destination** (the article list page, gated on
  `kb:article_view_list`, so the page isn't unreachable), and one `PAGE_SEARCH_TARGETS` entry (the
  per-list "search this page" affordance that is part of this repo's standard list-view pattern).
  Those are different surfaces from the action index — see Story 29's plan for why that
  distinction is load-bearing.

*(Customer-facing knowledge-base **search** is `USER_STORIES.md` Story 31 and remains unbuilt.)*

---

## Future audit log — keep in mind, do not build

**Out of scope here**, exactly as in Story 29. This story creates no `AuditLog` model, no stub, no
`logAudit()` call, and does not design the entry shape — the user is planning that cross-cutting
feature separately (`audit:view` is already reserved in
`backend/src/constants/permissions.ts`; `USER_STORIES.md` Story 47 is its backlog home).

**What this story does so hooking it up later is one line per action:** every article mutation goes
through a single choke-point function in `backend/src/services/helpArticle.service.ts` —
`createHelpArticle`, `updateHelpArticle`, `softDeleteHelpArticle` — **each taking `actorId`**, and
no route handler writes a `HelpArticle` document directly. There is no second write path to
forget. Together with `faq.service.ts`, the whole knowledge-base feature exposes exactly six
functions the audit log will need to touch.

**In-repo shape worth being consistent with** (input for that future planning exercise, not a
decision made here): `backend/src/models/Ticket.ts` lines 21–58 — five parallel **append-only**
arrays of `{ <new value>, changedBy: ObjectId, changedAt: Date }` embedded on the ticket. That
field vocabulary is what this codebase already reads naturally and is worth keeping; the
*embedding* is what does not generalise to a system-wide log (an admin publishing an article and a
customer logging in belong to no shared document, and "everything that happened last Tuesday" can't
be answered by scanning per-document arrays). A standalone collection with a stable
actor/action/target triple is the likely shape — but that is the audit-log story's call.

**`createdBy`/`updatedBy` on `HelpArticle` are not an audit trail** — current-state convenience
fields that overwrite on every edit, same as on `Faq` and `Ticket`. Do not grow them into one.

---

## Edge Cases & Failure Modes

- **Publishing with any of title/summary/body missing a language** → 400. Frontend disables Publish
  with a hint; the server check is the boundary.
- **Editing a published article down to one language on any field** → 400.
- **`POST` with `status: "published"`** → stripped by zod; created as a draft. Assert it.
- **`PATCH` with `{ body, status }` holding only `kb:article_edit`** → 403, nothing applied.
- **Explicit slug already taken** (including by a soft-deleted article) → 400 `errorSlugTaken`. A
  *generated* slug collision instead auto-suffixes `-2`, `-3`, … silently.
- **Slug with uppercase / Arabic / spaces** → rejected by `ARTICLE_SLUG_PATTERN` (400). The form
  slugifies as you type so this should be unreachable from the UI, but a raw request must fail.
- **Changing a published article's slug** → allowed, old links break, form warns. No redirect table
  (Open questions).
- **Markdown containing raw HTML** (`<script>`, `<iframe>`, `<img onerror=…>`) → rendered as inert
  visible text by `react-markdown` with no `rehype-raw`. **Add an explicit test/manual check for
  this** — it is the single security property this whole design rests on.
- **Markdown containing a `javascript:` link** → `react-markdown`'s default URL transform strips
  unsafe protocols. Do not override `urlTransform`. Verify manually.
- **A very long body (near 50KB)** → `maxlength` on the schema and `max` in zod both reject beyond
  it with a field error; the admin list never ships bodies at all; the public detail page ships one.
- **Image URL 404s / host blocks hotlinking** → a broken `<img>` on a public page. Accepted
  consequence of Design decision 3; the `alt` text is what the reader falls back to, which is why
  `alt` is prompted for.
- **Gemini unavailable, slow, or garbage** → identical to Story 29: `suggestTranslation` → `null`
  (quiet muted line), `findSimilarPublishedArticles` → `[]` (no warning), empty shortlist → no
  Gemini call at all, hallucinated ids dropped. Assert with `generateText` mocked to `null`.
- **Gemini mangles Markdown structure in a body translation** → the admin sees it in the Preview
  pane before saving, and it's ordinary editable text. This is exactly why the assist writes a
  *draft* into an editable field rather than saving anything.
- **A soft-deleted article's slug requested publicly** → 404, identical to an unknown slug.
- **`q` with regex metacharacters** → `escapeRegex`, mandatory.
- **A deactivated sub-admin's unexpired token** → live `isActive` re-check in `hasPermission` /
  `hasAnyPermission` rejects it immediately.

---

## Test Plan

**New file: `backend/tests/routes/kbHelpArticle.routes.test.ts`** — the full Story 29 FAQ matrix
re-run against articles (auth gate, role gate, per-key permission gates including the
deactivated-holder case, create-always-draft, create-cannot-publish, publish requires all three
fields in both languages, publish/unpublish `publishedAt` semantics, mixed-PATCH rejection with
nothing applied, soft delete + 404 on re-delete, list filters/sort/pagination/envelope,
`q` regex-metacharacter safety, `admin` passing with empty `permissions`), plus:

1. **Slug auto-generation** — create with `title.en = "How do I reset my password?"` and no slug →
   `slug === "how-do-i-reset-my-password"`.
2. **Slug collision on generation** → second article gets `-2`.
3. **Explicit slug collision** → 400 `errorSlugTaken`-equivalent message; **including a collision
   with a soft-deleted article**.
4. **Slug collision is case-insensitive** (`Getting-Started` vs `getting-started`) — proves the
   collation is actually applied.
5. **Invalid slug** (`Has Spaces`, `عربي`) → 400.
6. **Arabic-only draft with an empty English title** → slug falls back to `article-<hex>`, 201.
7. **List response omits `body`** but `GET /:id` includes it.
8. **`q` matches Arabic titles and summaries, and does *not* match body-only text** (proves the
   deliberate scope of the admin filter).

**File: `backend/tests/routes/kbPublic.routes.test.ts`** (extend Story 29's):

9. `GET /api/v1/kb/public/articles` with **no auth** → 200; drafts and soft-deleted absent; no
   `status`/`publishedAt`/`createdBy`; no `body` in list rows.
10. `GET /api/v1/kb/public/articles/:slug` → 200 with both bodies; **mixed-case slug resolves**.
11. Same endpoint for a **draft's** slug → 404; for a soft-deleted article's slug → 404; for an
    unknown slug → 404 — **all three responses identical**.
12. `?status=published` / `?status=draft` on the list are ignored; the filter is not
    caller-controllable.

**File: `backend/tests/services/kbAi.service.test.ts`** (extend):

13. `findSimilarPublishedArticles` with an empty shortlist ⇒ `[]` and **`generateText` never
    called**.
14. Non-JSON / hallucinated-id output ⇒ `[]` / id dropped.
15. `suggestTranslation({ kind: "body" })` with `generateText` → `null` ⇒ `null`, no throw; route
    responds **200** `{ translation: null }`.
16. A body translation longer than `ARTICLE_BODY_MAX_LENGTH` ⇒ `null`.

`cd backend && npm run typecheck` clean, **no new `any`**.

**Frontend:** no runner (`CLAUDE.md`) — manual, below. The raw-HTML-is-inert check is the one that
must not be skipped.

---

## Migration / Rollback

- **Additive:** one new collection (`helparticles`), four new permission keys, one new router mount,
  two new endpoints on the existing public router, one new npm dependency pair in `frontend/`.
  Nothing existing changes shape.
- **The dependency is the only non-trivial rollback:** `npm uninstall react-markdown remark-gfm`,
  delete `frontend/components/ArticleBody.tsx` and the editor's preview pane. If `CLAUDE.md`'s
  "Current pinned exceptions" gained an entry for either package, remove it in the same revert.
- **Rollback otherwise:** delete `models/HelpArticle.ts`, `validation/kbHelpArticle.schema.ts`,
  `services/helpArticle.service.ts`, `routes/kbHelpArticle.routes.ts`; revert the article additions
  to `constants/kb.ts`, `constants/permissions.ts`, `frontend/lib/permissions.ts`,
  `services/kbAi.service.ts`, `routes/kbPublic.routes.ts`, `app.ts`, `staffNav.ts`,
  `HeaderSearch.tsx`, and both message files; delete `frontend/app/admin/kb/articles/`. Drop the
  `helparticles` collection. **Story 29 must still pass its own tests after the revert** — that is
  the check that this story didn't quietly change shared code.

---

## Verification Steps

1. `cd frontend && npm run build` — **immediately after the dependency install**, before any other
   work.
2. `cd backend && npm run typecheck` → 0; `npm test` → all green; `npm run build` → clean.
3. **Route smoke, admin JWT:** create an English-only article → 201 draft with a generated slug;
   publish → **400**; fill Arabic title/summary/body → publish → 200; `GET
   /api/v1/kb/public/articles/<slug>` **with no auth header** → 200; unpublish → the same public
   URL 404s; delete → still 404.
4. **Slug smoke:** create a second article with the same title → slug `-2`; try to set an explicit
   slug equal to an existing one → 400; try `Has Spaces` → 400.
5. **Permission smoke:** a sub-admin holding only `kb:article_view_list` sees the list and 403s on
   every mutation; granting `kb:article_edit` still 403s a `{ status }` PATCH.
6. **Cross-entity check:** an account holding every `kb:faq_*` key but **no** `kb:article_*` key can
   use `/admin/kb/faqs` fully and cannot see or reach `/admin/kb/articles` — the point of
   per-entity keys.
7. `cd frontend && npm run build` again → no type errors.
8. **Manual UI:** as admin, the sidebar shows **Help articles**; the list filters/sort/search/reset/
   pagination all work and every filter round-trips through the URL. Write an article using
   `## headings`, a numbered list, a link, a table, and an `![alt](url)` image; the **Preview** tab
   renders all of it with the app's own typography, the table scrolls horizontally rather than
   breaking the page, and the image is capped at container width. **Publish is disabled with a
   hint** until all three fields exist in both languages. Use **Draft translation with AI** on the
   body, confirm the Markdown structure survives, edit it, publish.
9. **Security check (do not skip):** put `<script>alert(1)</script>` and
   `<img src=x onerror=alert(1)>` and `[click](javascript:alert(1))` in a body. In both the admin
   preview and the public page: the first two must appear as **visible inert text**, the third must
   render as a link with the `javascript:` URL stripped. **Nothing may execute.**
10. **RTL check:** switch the UI to Arabic — the whole page mirrors; the article body renders RTL;
    then switch back to English and confirm an article whose Arabic body is being previewed still
    renders that pane RTL inside an LTR page (the per-block `dir`).
11. **Gemini-off smoke:** unset `GEMINI_API_KEY`, restart — the AI button shows the quiet
    "unavailable" line and the whole write → translate-by-hand → publish flow still completes.
12. **Regression:** Story 29's FAQ pages and tests still pass unchanged; `/admin/users`,
    `/admin/ticket-categories`, `/tickets`, `/customers` untouched; ⌘K offers no new quick-create
    actions.

---

## Done Criteria

- [ ] `HelpArticle` stores `title`/`summary`/`body` bilingually in one document using the **shared**
      `ILocalizedText` from Story 29 (no second bilingual shape introduced), with `slug`,
      `category`, `status`, `publishedAt`, `isDeleted`, `createdBy`/`updatedBy`, and
      `timestamps: true` supplying the story's "last-updated date".
- [ ] Body is **Markdown**; `react-markdown` + `remark-gfm` are installed per `CLAUDE.md`'s
      dependency-freshness procedure; **`rehype-raw` is not installed or used anywhere**, and raw
      HTML in a body renders as inert text (verified manually).
- [ ] `frontend/components/ArticleBody.tsx` is the single renderer, used by both the admin preview
      and (in Story 31) the public page, with theme tokens only and per-block `dir`/`lang`.
- [ ] `kb:article_view_list` / `kb:article_create` / `kb:article_edit` / `kb:article_delete` exist
      in both permission vocabularies and both `SUBADMIN_ONLY_PERMISSIONS` sets and are labelled in
      both message files; **`kb:publish` is reused**, not duplicated.
- [ ] `POST` cannot publish; `PATCH` splits content vs. `status` per changed field; publishing
      requires **all three** fields in **both** languages.
- [ ] Slugs are language-neutral, generated-then-editable, unique case-insensitively **including
      against soft-deleted articles**, and validated against `ARTICLE_SLUG_PATTERN`.
- [ ] `GET /api/v1/kb/public/articles` and `/articles/:slug` serve published, non-deleted content
      with **no auth**, from `kbPublic.routes.ts`, and cannot be coaxed into returning a draft.
- [ ] All article mutations go through `services/helpArticle.service.ts`, each taking `actorId`; no
      route handler writes a `HelpArticle` directly.
- [ ] Gemini draft-translate (including Markdown-preserving body translation) and duplicate-flag
      both work, are optional, never block a save, and are silently absent when Gemini is
      unavailable — proven by a test with `generateText` mocked to `null`.
- [ ] `/admin/kb/articles` implements the standard list-view pattern with every param forwarded to
      the backend fetch, and hides every control the viewer's permissions don't cover.
- [ ] Forms use controlled inputs and `zod`-in-the-Server-Action with per-field errors.
- [ ] Every new string is in **both** `en.json` and `ar.json`; no hardcoded English; no hardcoded
      hex.
- [ ] **No** notification fires and **no** `STAFF_ACTION_ITEMS` / command-palette entry is added for
      any KB admin action; both exclusions are documented in code comments.
- [ ] No `AuditLog` model, stub, or call exists.
- [ ] Story 29's tests still pass unchanged.
- [ ] `npm run typecheck` + `npm test` (backend) and `npm run build` (frontend) all pass clean.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 31
(knowledge-base customer browsing).**

---

## Open questions for the user

1. **Images with no host.** Design decision 3 accepts externally-hosted image URLs in the Markdown
   because no content asset store exists. That means an admin with nowhere to host an image
   effectively cannot add one. Options: (a) ship as-is and rely on an external host; (b) a separate,
   later story adds a small admin-only asset upload (which would be genuinely useful beyond the KB —
   branding, etc.); (c) accept data-URI images (simple, but bloats documents and is bad for page
   weight — not recommended). **Which?**
2. **Slug changes on published articles.** Changing a published article's slug breaks every existing
   link to it. This plan warns in the UI and does nothing else — no redirect table, no
   `previousSlugs` array. Adding `previousSlugs: string[]` and resolving it in
   `GET /public/articles/:slug` is cheap (one array + one `$or`) if you want old links to keep
   working. **Worth it now, or leave it?**
3. **Article length cap.** `ARTICLE_BODY_MAX_LENGTH = 50_000` characters per language is a guess —
   roughly a very long guide. Fine, or do you want it higher/lower?
4. **Hard delete / purge** — same question as Story 29's open question 3; if you want a real purge
   action it should be designed once for both entities, and by this repo's granularity convention
   it is its own permission key (or key pair).
