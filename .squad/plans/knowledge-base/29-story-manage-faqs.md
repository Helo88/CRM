# Story 29 — Manage FAQs (Story: 29)

> **Hand-authored plan.** This feature was deliberately *not* run through squad-kit's
> `squad new-plan` generator (the user's call: "just UI and forms, mainly effort in UI").
> The intake at `.squad/stories/knowledge-base/manage-faqs/intake.md` is still the real
> requirements source; this file replaces what the generator would have produced.
> Do not re-run the generator over this folder — it would overwrite these files.

> **AMENDMENT (2026-09-02), after a UI concept review — read before trusting anything
> below about status/routes/table layout.** Three decisions below this point changed
> from what's written further down, and the implementation follows the amendment, not
> the original text:
>
> 1. **No draft/published state at all.** An FAQ is live for customers the moment it's
>    saved — no `status`/`publishedAt` fields, no `kb:publish` gate, no "Save as draft"
>    step. `kb:publish` (the permission key) was **removed entirely** from
>    `backend/src/constants/permissions.ts` / `frontend/lib/permissions.ts` / both
>    message files — it is not reused, not renamed, gone. `kb:faq_create`/`kb:faq_edit`
>    are the only gates a content write needs, so `PATCH /kb/faqs/:id` is one
>    `requirePermission("kb:faq_edit")`, not the per-field split described below.
>    (This also means `security-admin`'s "17 fixed permission keys" is now 16 fewer
>    `kb:*` + the new `kb:faq_*`/`kb:article_*` keys — see that story's plan.)
> 2. **Add/edit is a dialog, opened from the list — never a route.** There is no
>    `/admin/kb/faqs/new` or `/admin/kb/faqs/[id]/edit` page. `FaqDialog.tsx` (Client
>    Component) handles both create and edit, triggered by "New FAQ" or a row's edit
>    icon, calling the same Server Actions described below.
> 3. **The list is expandable rows (an icon rail + category badge + bilingual question,
>    answer revealed on expand), not a table.** Built from a reference UI the user
>    shared, not the `<Table>` shape in Task 12 below. See
>    `frontend/app/admin/kb/faqs/FaqAccordionList.tsx`.
>
> Everything else below — the bilingual `ILocalizedText` pattern, the category
> taxonomy, the AI draft-translate/duplicate-flag assists, the public read endpoint's
> shape, the deliberate exclusions — held up and was implemented as written (minus the
> status field). Treat the "Design decision 2" permission table, the PATCH per-field
> split, and Tasks 12/15 (table columns, `/new` and `/[id]/edit` routes) as superseded
> by this amendment, not as the source of truth.

## Prerequisites

- **Auth/RBAC foundation is complete and must be used as-is**: `requireAuth` / `requireRole` /
  `requirePermission` in `backend/src/middleware/auth.ts`, `hasPermission` / `isActiveAccount` in
  `backend/src/services/permissions.ts`, the fixed key vocabulary in
  `backend/src/constants/permissions.ts`. `admin` always short-circuits the key check (but still
  gets a live `isActive` lookup); `agent`/`subadmin` are checked against a live DB read of their
  own `User.permissions` on every request; `customer` and unauthenticated callers are rejected.
- **`backend/src/constants/permissions.ts` already reserves `kb:publish`** (listed in
  `SUBADMIN_ONLY_PERMISSIONS`, already labelled in `frontend/lib/permissions.ts` and in the
  `Permissions.keys` i18n section) with **no implementation behind it**. This story is the first
  to actually gate anything on it. Do **not** introduce a differently-named publish key.
- **`backend/src/models/User.ts` already exports `Language = "en" | "ar"`** (line 6). Reuse it —
  do not define a second English/Arabic union anywhere.
- **`backend/src/routes/ticketCategory.routes.ts` is the closest existing precedent** for this
  story: an admin-managed reference resource whose create / edit / toggle-status actions each have
  their own permission key, with the per-field key check done *inside* the PATCH handler
  (`callerHasPermission`) because the required key depends on which fields the request is changing.
  Copy that shape rather than inventing one.
- **`frontend/app/admin/users/page.tsx` + `AdminUsersFilterBar.tsx` + `RowActions.tsx`** are the
  reference implementation of the standard list-view pattern (server-driven `?page/q/filters/sort`,
  `ListPagination`, a filter bar whose reset button sits in its own row, per-permission
  `canEdit`/`canToggleStatus`/`canDelete` flags derived from `peekJwtPayload`, mobile-cards /
  desktop-table split).
- **No FAQ model, router, or page exists.** `backend/src/app.ts`'s TODO comment still lists
  `knowledge-base` among the unmounted feature routers — this story removes it from that list.
- **This is the first story in the `knowledge-base` feature folder.** Story 30 (help articles)
  copies the bilingual-content, draft/published, soft-delete, service-choke-point and AI-assist
  patterns established here; Story 31 (customer browsing) consumes the public read endpoints
  defined here. Get the shape right once.

---

## Story Goal

1. An admin (or a sub-admin holding the matching granular `kb:faq_*` key) can **create,
   edit, publish/unpublish, and delete FAQs** from a real admin UI — not just an API. This is
   admin/sub-admin territory only — the new keys join `SUBADMIN_ONLY_PERMISSIONS` (see "Permission
   design" below) so an agent account can never be granted them, regardless of what an admin
   selects on the permissions screen.
2. Every FAQ stores **both English and Arabic** copy for both user-facing fields (`question`,
   `answer`) in **one document**, not one document per language. This is the **first bilingual
   content model in the codebase**; the `ILocalizedText` shape introduced here is the pattern
   Story 30 reuses verbatim.
3. FAQs are **organized by category** and carry a **`draft` / `published`** state. Only
   `published` (and not soft-deleted) FAQs are ever visible to a customer.
4. Two **narrow, optional, non-blocking Gemini assists** on the authoring side only:
   **draft-translate** (fill one language, get an editable machine draft of the other) and
   **duplicate-flag** (after creating a draft, warn if a very similar published FAQ already
   exists). Neither ever gates a save; both degrade to silence when Gemini is slow or unset.
5. The **public, published-only read endpoint** that Story 31's customer browse page consumes is
   defined here (`GET /api/v1/kb/public/faqs`) so Story 31 is pure frontend + a sibling article
   endpoint.

**Out of scope (deliberate, each with a reason):**

- **Help articles** — Story 30. Different model, longer-form, Markdown body, its own routes/pages.
- **Keyword search across the knowledge base** — Story 31 in `USER_STORIES.md` (ranked results
  across FAQs *and* articles, bilingual, with no-result logging so content gaps surface). The
  **admin** list here does get a plain `?q=` substring filter, because that is part of this repo's
  standard list-view pattern for every admin list — that is a list filter, not the knowledge-base
  search feature, and it must not be built out into one here.
- **Agent-facing AI-suggested KB solutions** — Story 35 (`ai-features`): ranking KB content against
  a live ticket/chat and learning from accept/dismiss feedback. Explicitly **not** started here.
  The only AI in this story runs in the admin authoring form.
- **In-app notifications and global quick-search entries for KB admin actions** — see
  "Deliberate exclusions" below. This is a decision, not an oversight.
- **A generic system-wide audit log** — see "Future audit log" below.
- **Admin-editable FAQ categories** — the category vocabulary is a fixed code-level list this
  story introduces (justified below). No third CRUD resource.

---

## Context — Read These Files First

1. `backend/src/constants/permissions.ts` — the whole file (112 lines). `PERMISSION_KEYS`,
   `SUBADMIN_ONLY_PERMISSIONS`, `permissionKeysAllowedForRole`, `DEFAULT_PERMISSIONS_BY_ROLE`.
   Note the `staff:*` and `tickets:categories_*` naming style — the new keys mirror it exactly.
2. `backend/src/middleware/auth.ts` — `requirePermission(key)` (lines 93–118): admin
   short-circuits after a live `isActiveAccount` check; agent/subadmin go through
   `hasPermission`; everyone else is rejected. Never re-implement a role check inside a handler.
3. `backend/src/services/permissions.ts` — 37 lines. `hasPermission(userId, key)` and
   `isActiveAccount(userId)`. **This story adds one function here** (`hasAnyPermission`).
4. `backend/src/routes/ticketCategory.routes.ts` — the whole file (158 lines). The
   `callerHasPermission(req, key)` local helper (lines 53–56) and the per-field permission split in
   `PATCH /:id` (lines 131–138) are copied almost verbatim by this story's PATCH handler.
5. `backend/src/models/TicketCategory.ts` — model shape, collation-based case-insensitive unique
   index, and the house style for a long explanatory model docblock.
6. `backend/src/models/User.ts` — lines 1–10 for `Language`; lines 60–90 for the `isDeleted`
   soft-delete precedent this story copies.
7. `backend/src/models/Ticket.ts` — lines 21–58. The append-only `{ <value>, changedBy, changedAt }`
   history-entry shape. **Read it for the "Future audit log" section**, not to copy into this model.
8. `backend/src/services/gemini.service.ts` — the whole file (49 lines). `generateText(prompt, {
   timeoutMs })` returns `string | null` and **never throws**: no key configured, timeout, and API
   error all return `null`. Every AI assist here is built on that one function.
9. `backend/src/services/liveChatAi.service.ts` — naming/structure precedent for a feature-specific
   AI service that sits on top of `gemini.service.ts`.
10. `backend/src/validation/common.ts` and `backend/src/validation/admin.schema.ts` — `requiredString`,
    `paginationQuerySchema`, `objectIdSchema`, and the `listStaffAccountsQuerySchema` shape (q /
    filter / sort regex) this story's list query schema mirrors.
11. `backend/src/middleware/validate.ts` — `validateBody` / `validateParams`; the `{ error: string }`
    400 contract every route already uses.
12. `backend/src/routes/admin.routes.ts` — lines 72–125 (`GET /`): `escapeRegex`-based `q` search,
    filter object assembly, `sortSpec` parsing, `Promise.all([find, countDocuments])`, and the
    `{ items, total, page, limit }` response envelope. Reuse this envelope exactly.
13. `backend/src/app.ts` — 37 lines. Router mount list and the TODO comment listing unmounted
    features (`knowledge-base` is in it).
14. `frontend/app/admin/users/page.tsx` — 242 lines. The canonical admin list page: `generateMetadata`
    with `robots: { index: false, follow: false }`, the `_refreshed` one-shot refresh guard,
    401→refresh / 403→`/dashboard` handling, `peekJwtPayload`-derived `can*` flags,
    `showActionsColumn`, mobile cards + desktop table, `ListPagination` with `hrefForPage`.
15. `frontend/app/admin/users/AdminUsersFilterBar.tsx` — 149 lines. `FilterField` + `Select`
    controls, the `__all__` sentinel, `params.delete("page")` on every change, the active-filter
    highlight (`border-primary/50 bg-primary/5 text-primary`), the `q` chip, and the reset button
    **in its own row outside the flex-wrap**, styled `ghost` + `text-destructive`.
16. `frontend/app/admin/ticket-categories/` — `page.tsx`, `RowActions.tsx`, `ConfirmActionButton.tsx`,
    `actions.ts`, `new/`. The smaller, closer-in-spirit admin CRUD surface. Note
    `ConfirmActionButton.tsx`'s header comment: this project deliberately keeps **route-local
    copies** of row-action helpers rather than promoting them to `frontend/components/` — follow
    that, make a third local copy, do not "DRY it up".
17. `frontend/lib/staffNav.ts` — `STAFF_NAV_ITEMS` (destinations) vs `STAFF_ACTION_ITEMS`
    (quick-create actions), and `isVisibleForRole`'s one-`permission`-per-item rule. **This story
    adds to the first list and deliberately not to the second** — see "Deliberate exclusions".
18. `frontend/components/HeaderSearch.tsx` — lines 15–19 `PAGE_SEARCH_TARGETS` (per-list "search
    this page" affordance) vs lines 49–52 (nav/action quick-jump list). The distinction between
    these two is load-bearing for this story's exclusions.
19. `frontend/lib/locale.ts` (`LOCALE_COOKIE`, `Locale`, `localeDir`), `frontend/lib/jwt.ts`
    (`peekJwtPayload`), `frontend/lib/session.ts` (`refreshSession`).
20. `frontend/app/admin/ticket-categories/actions.ts` — the Server Action shape: `getBearerToken()`
    → `refreshSession()` fallback, `doFetch(bearer)` + retry-once on 401, `mapBackendError`,
    `revalidatePath`, `{ error: string | null }` state.
21. `frontend/components/ui/` — installed primitives. `accordion` is **not** installed (needed by
    Story 31, not by this story); everything this story needs (`table`, `badge`, `button`, `input`,
    `textarea`, `label`, `select`, `alert-dialog`, `tabs`, `card`, `alert`) already is.

---

## Product rules (from the story)

- FAQs are organized by topic/category. → fixed `category` slug from a shared KB vocabulary.
- FAQs can be draft or published; only published ones are customer-visible. → `status`, plus a
  `publishedAt` stamp and an `isDeleted` soft-delete flag; **every** customer-facing read filters
  `{ status: "published", isDeleted: { $ne: true } }`.
- FAQs support both English and Arabic content. → `question` and `answer` are each an
  `ILocalizedText` `{ en, ar }` subdocument in the **same** document.

---

## Design decision 1 — the bilingual field pattern (`ILocalizedText`)

**New file: `backend/src/models/localizedText.ts`**

```ts
import { Schema } from "mongoose";
import type { Language } from "./User";

/**
 * The project's ONE bilingual-content shape. Introduced by knowledge-base
 * Story 29 (FAQs) and reused unchanged by Story 30 (help articles) — every
 * customer-facing text field on a bilingual content model is one of these,
 * never two parallel scalar fields (`questionEn`/`questionAr`) and never a
 * separate document per language.
 *
 * Why one document with both languages, not a document per language:
 * keeping the pair together makes "these two strings are the same FAQ" a
 * structural fact rather than a join, so a translation can never silently
 * orphan itself, and the draft/published state is decided once for the FAQ
 * rather than drifting between two language rows.
 *
 * Keys are exactly the `Language` union from models/User.ts — do not
 * redefine "en" | "ar" anywhere else (intake note, Story 29).
 */
export type ILocalizedText = Record<Language, string>;

export function localizedTextSchema(maxlength: number) {
  return new Schema<ILocalizedText>(
    {
      // Neither side is `required` at the schema level: a DRAFT may
      // legitimately have only one language filled in while the other is
      // still being written or waiting on the AI draft-translate assist.
      // The real rule — "published content must have BOTH languages" — is a
      // business rule, enforced at the service choke point (see
      // services/faq.service.ts), not a schema constraint, because it
      // depends on `status`, which lives on the parent document.
      en: { type: String, default: "", trim: true, maxlength },
      ar: { type: String, default: "", trim: true, maxlength },
    },
    { _id: false }
  );
}

export function hasBothLanguages(text: ILocalizedText | undefined): boolean {
  return Boolean(text?.en?.trim() && text?.ar?.trim());
}

export function hasAnyLanguage(text: ILocalizedText | undefined): boolean {
  return Boolean(text?.en?.trim() || text?.ar?.trim());
}
```

**The rule this establishes, and that Story 30 must follow:**

| State | Requirement |
|---|---|
| `status: "draft"` | **At least one** language non-empty per user-facing field. |
| `status: "published"` | **Both** languages non-empty for **every** user-facing field. |

This is what makes the AI draft-translate assist genuinely useful rather than decorative: an admin
writes the English, saves a draft, generates + edits the Arabic, then publishes. Publishing is the
gate that guarantees a customer never sees a half-translated FAQ.

**Frontend counterpart — new file `frontend/lib/localized.ts`:**

```ts
import type { Locale } from "@/lib/locale";

export interface LocalizedText {
  en: string;
  ar: string;
}

// Picks the viewer's language for CONTENT (an FAQ's question, an article's
// body) — a completely separate concern from next-intl's `t()`, which
// translates the UI CHROME (labels, buttons, table headers). Chrome is
// translated by us at build time from messages/{en,ar}.json; content is
// translated by an admin at authoring time and stored in the document.
// Both are driven by the same LOCALE_COOKIE, and that is the only thing
// they share.
//
// The fallback exists only for defence in depth: publish validation
// already guarantees both languages are present on published content, so a
// fallback should be unreachable for anything a customer can see. It still
// matters for the ADMIN previews, which render drafts.
export function pickLocalized(text: LocalizedText, locale: Locale): {
  value: string;
  /** The language actually rendered — may differ from `locale` on a draft. */
  language: Locale;
} {
  const primary = text[locale]?.trim();
  if (primary) return { value: primary, language: locale };
  const other: Locale = locale === "en" ? "ar" : "en";
  return { value: text[other]?.trim() ?? "", language: other };
}
```

Any place that renders a fallback language must set `lang` and `dir` on that element (see Task 16
and Story 31) — otherwise an Arabic string inside an English page inherits `dir="ltr"` and
mis-renders.

---

## Design decision 2 — permission keys

**Chosen key set (this story adds the first five; Story 30 adds the article half):**

| Key | Gates | Subadmin-only? |
|---|---|---|
| `kb:faq_view_list` | `GET /kb/faqs`, `GET /kb/faqs/:id`, the `/admin/kb/faqs` page | yes |
| `kb:faq_create` | `POST /kb/faqs` | yes |
| `kb:faq_edit` | `PATCH /kb/faqs/:id` when content fields change | yes |
| `kb:faq_delete` | `DELETE /kb/faqs/:id` | yes |
| `kb:publish` | **already reserved** — `PATCH /kb/faqs/:id` when `status` changes | yes (already) |

**Why per-entity keys for CRUD but one shared key for publish** (the justification the brief asked
for, spelled out so a reviewer doesn't "correct" it later):

- *Per-entity CRUD (`kb:faq_*` now, `kb:article_*` in Story 30) rather than one shared `kb:create`
  etc.* — FAQs and help articles are two genuinely different jobs: a short bilingual Q&A pair
  curated by whoever answers tickets all day, versus long-form Markdown documentation. It is
  entirely reasonable to let someone maintain FAQs without also handing them the guides, and the
  reverse. Collapsing them into `kb:create` would make that impossible. This is also exactly what
  the existing vocabulary already does one level down inside a domain: `tickets:categories_create`
  is a separate key from `tickets:categorize`, because they are separate resources that happen to
  share a prefix.
- *One shared `kb:publish` across both entities* — three reasons, in order of weight: (1) it is
  **already reserved** in `PERMISSION_KEYS`, already in `SUBADMIN_ONLY_PERMISSIONS`, already
  mirrored in `frontend/lib/permissions.ts`, and already labelled in the `Permissions.keys` i18n
  section as "Publish knowledge base articles" — splitting it into `kb:faq_publish` /
  `kb:article_publish` would churn all four of those and silently orphan the grant on any account
  that already has it; the brief explicitly says to use/extend it rather than duplicate it.
  (2) Publishing is not a content-type skill, it is a single editorial authority: "this text is
  now shown to every customer, in both languages". That is the same authority whichever collection
  it lands in. (3) It keeps the *most* consequential action in the feature to exactly one key that
  is easy to audit — "who can make KB content customer-visible?" has one answer, not two.
- *No separate `kb:faq_view_account`-style key for `GET /:id`.* The `staff:view_list` /
  `staff:view_account` split exists because a staff roster row shows less than an account detail
  page does. There is no such split here — the list endpoint already returns the FAQ's full
  bilingual content, so a separate single-document key would be granularity with no distinct
  grantable meaning. `GET /:id` therefore reuses `kb:faq_view_list`.
- *All five are sub-admin-only* (added to `SUBADMIN_ONLY_PERMISSIONS`), matching `kb:publish`'s
  existing classification and the "staff/system administration is a sub-admin-tier concern"
  rule in `.squad/plans/security-admin/00-overview.md`. Authoring the knowledge base is a content-
  administration job, not day-to-day ticket work. `DEFAULT_PERMISSIONS_BY_ROLE` is **not** changed —
  `subadmin` still defaults to `[]` and these are granted deliberately per account.

**Enforcement rules that must not be softened:**

- `POST /kb/faqs` **always creates a draft.** It does not accept a `status` field at all. This is
  what stops `kb:faq_create` from being a back door around `kb:publish` — without it, an account
  holding only `kb:faq_create` could publish by creating with `status: "published"`.
- `PATCH /kb/faqs/:id` checks keys **per changed field**, inside the handler, exactly like
  `ticketCategory.routes.ts` does: content fields require `kb:faq_edit`; a `status` change requires
  `kb:publish`; a request changing both requires both.
- The frontend **hides** (does not merely disable) any control the viewer's permissions don't
  cover, and omits the whole Actions column when they cover none of them — the
  `canEdit`/`canToggleStatus`/`canDelete`/`showActionsColumn` pattern from
  `frontend/app/admin/users/page.tsx` lines 116–121. The backend is the real boundary; the hiding
  is so nobody is offered a control that would just 403.

---

## Design decision 3 — the category vocabulary

FAQs and help articles share **one fixed, code-level category vocabulary**
(`backend/src/constants/kb.ts`), not a `KbCategory` collection.

**Why:** the acceptance criteria ask for "organized by topic/category" and the intake explicitly
warns against over-building a taxonomy. A `KbCategory` collection would be a *third* admin-managed
resource — its own model, router, four more permission keys, its own list page and forms — for a
list that is expected to change once a year. It would also need its own bilingual `name` field,
which means an admin would have to translate category names too. A fixed slug list with labels in
`messages/{en,ar}.json` gives bilingual category names for free and keeps the taxonomy shared
between FAQs and articles, which Story 31's combined browse page needs anyway.

**Tradeoff, stated plainly:** adding a category becomes a code change (two constants + two message
files), not an admin action. If that becomes painful, the migration is cheap and non-breaking:
introduce a `KbCategory` collection keyed by the *same slugs*, seed it from the constant, and the
stored `category` string on every FAQ/article keeps resolving. Nothing here forecloses it. See
"Open questions for the user".

**New file: `backend/src/constants/kb.ts`**

```ts
// Shared by knowledge-base Stories 29 (FAQs), 30 (help articles) and 31
// (customer browsing) — one taxonomy across the whole knowledge base, so the
// customer-facing browse page can filter FAQs and articles with a single
// category control. Labels are NOT here: they are bilingual and live in
// frontend/messages/{en,ar}.json under the "KbCategories" section, keyed by
// these exact slugs. See the plan's "Design decision 3" for why this is a
// fixed list rather than an admin-managed collection.
export const KB_CATEGORY_SLUGS = [
  "getting-started",
  "account-and-profile",
  "tickets-and-support",
  "live-chat",
  "billing-and-payments",
  "troubleshooting",
  "privacy-and-security",
] as const;
export type KbCategorySlug = (typeof KB_CATEGORY_SLUGS)[number];

export const KB_STATUSES = ["draft", "published"] as const;
export type KbStatus = (typeof KB_STATUSES)[number];

export const FAQ_QUESTION_MAX_LENGTH = 300;
export const FAQ_ANSWER_MAX_LENGTH = 5000;
```

---

## Backend Tasks

### 1 — Permission keys

**File: `backend/src/constants/permissions.ts`**

- Add to `PERMISSION_KEYS`, grouped under a comment next to the existing `kb:publish` entry:

  ```ts
  // knowledge-base Story 29: FAQ authoring. Per-action keys (view/create/
  // edit/delete) rather than one umbrella "kb:manage" — see
  // [[feedback_granular_action_permissions]]. Deliberately per-ENTITY
  // (kb:faq_* here, kb:article_* in Story 30) because curating short Q&A
  // pairs and writing long-form guides are separately delegable jobs.
  "kb:faq_view_list",
  "kb:faq_create",
  "kb:faq_edit",
  "kb:faq_delete",
  // Reserved since security-admin Story 46, first IMPLEMENTED here. Shared
  // by FAQs and help articles on purpose: publishing is one editorial
  // authority ("this is now customer-visible, in both languages"),
  // independent of which collection the content lives in.
  "kb:publish",
  ```

  (`kb:publish` already exists — move it into this block rather than adding a second entry.)
- Add the four new keys to `SUBADMIN_ONLY_PERMISSIONS` (`kb:publish` is already there).
- **Do not** touch `DEFAULT_PERMISSIONS_BY_ROLE`.

**File: `frontend/lib/permissions.ts`** — extend the `kb` category to
`["kb:faq_view_list", "kb:faq_create", "kb:faq_edit", "kb:faq_delete", "kb:publish"]`, and add the
four new keys to the frontend `SUBADMIN_ONLY_PERMISSIONS` set. This file is a deliberate mirror of
the backend constant (see its header comment) — keep them in lockstep in the same change.

**Files: `frontend/messages/en.json` + `ar.json`** — add labels under `Permissions.keys`:

```json
"kb:faq_view_list": "View the FAQ list",
"kb:faq_create": "Add FAQs",
"kb:faq_edit": "Edit FAQs",
"kb:faq_delete": "Delete FAQs"
```

`Permissions.categories.kb` ("Knowledge base") already exists. `kb:publish`'s existing label is
"Publish knowledge base articles" — reword it to **"Publish knowledge base content"** in both
files, since it now covers FAQs too.

### 2 — Shared bilingual + KB constants

Create `backend/src/models/localizedText.ts` and `backend/src/constants/kb.ts` exactly as specified
in Design decisions 1 and 3 above.

### 3 — The `Faq` model

**New file: `backend/src/models/Faq.ts`**

```ts
import mongoose, { Document, Schema, Types } from "mongoose";
import { ILocalizedText, localizedTextSchema } from "./localizedText";
import {
  KB_CATEGORY_SLUGS,
  KB_STATUSES,
  KbCategorySlug,
  KbStatus,
  FAQ_QUESTION_MAX_LENGTH,
  FAQ_ANSWER_MAX_LENGTH,
} from "../constants/kb";

/**
 * knowledge-base Story 29. The first bilingual CONTENT model in this
 * codebase — `question` and `answer` each hold both languages in one
 * document (see models/localizedText.ts for why).
 *
 * Draft/published, not a boolean: `status` is a two-value enum so a third
 * state (e.g. "archived") can be added later without a data migration, and
 * so it reads the same way TicketStatus does elsewhere in this codebase.
 *
 * Soft delete, not a hard delete: mirrors User.isDeleted (security-admin
 * Story 45). Deleting a translated pair of strings is unrecoverable, a
 * future audit log will want the document to still exist to point at, and
 * ai-features Story 35 will eventually reference KB documents by id.
 * Nothing in the app ever reads a deleted FAQ.
 */
export interface IFaq extends Document {
  question: ILocalizedText;
  answer: ILocalizedText;
  category: KbCategorySlug;
  status: KbStatus;
  /** Set the first time it is published; kept (not cleared) on unpublish. */
  publishedAt: Date | null;
  isDeleted: boolean;
  // Current-state authorship only — NOT an audit trail (see the plan's
  // "Future audit log" section). Nullable so a future seed/import path
  // doesn't need a synthetic user.
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const faqSchema = new Schema<IFaq>(
  {
    question: { type: localizedTextSchema(FAQ_QUESTION_MAX_LENGTH), required: true },
    answer: { type: localizedTextSchema(FAQ_ANSWER_MAX_LENGTH), required: true },
    category: { type: String, enum: KB_CATEGORY_SLUGS, required: true },
    status: { type: String, enum: KB_STATUSES, default: "draft", required: true },
    publishedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// The public browse query (Story 31): published, not deleted, optionally
// narrowed to one category, newest first.
faqSchema.index({ status: 1, isDeleted: 1, category: 1, createdAt: -1 });

export const Faq = mongoose.model<IFaq>("Faq", faqSchema);
```

**Deliberately not added:** a manual `order` field. No acceptance criterion asks for ordering, and
a drag-to-reorder UI is real work; FAQs sort by `createdAt` within a category. Note it as an easy
later addition.

### 4 — Validation schemas

**New file: `backend/src/validation/kbFaq.schema.ts`**

```ts
import { z } from "zod";
import { KB_CATEGORY_SLUGS, KB_STATUSES, FAQ_QUESTION_MAX_LENGTH, FAQ_ANSWER_MAX_LENGTH } from "../constants/kb";
import { paginationQuerySchema, objectIdSchema } from "./common";

export const faqIdParamsSchema = z.object({ id: objectIdSchema("Invalid FAQ id") });

// Both languages optional individually, but at least one required — the
// "published needs both" rule can't live here (it depends on `status`,
// which POST doesn't accept and PATCH only sometimes carries), so it is
// enforced once at the service choke point instead. See faq.service.ts.
const localizedTextSchema = (max: number, label: string) =>
  z
    .object({
      en: z.string().trim().max(max, `${label} (English) must be at most ${max} characters`).optional().default(""),
      ar: z.string().trim().max(max, `${label} (Arabic) must be at most ${max} characters`).optional().default(""),
    })
    .refine((v) => Boolean(v.en || v.ar), { message: `${label} is required in at least one language` });

export const createFaqBodySchema = z.object({
  question: localizedTextSchema(FAQ_QUESTION_MAX_LENGTH, "question"),
  answer: localizedTextSchema(FAQ_ANSWER_MAX_LENGTH, "answer"),
  category: z.enum(KB_CATEGORY_SLUGS, { error: "category must be one of the knowledge-base categories" }),
  // NOTE: no `status`. POST always creates a draft — publishing is a
  // separate action gated on kb:publish. Do not add it here.
});

export const updateFaqBodySchema = z
  .object({
    question: localizedTextSchema(FAQ_QUESTION_MAX_LENGTH, "question").optional(),
    answer: localizedTextSchema(FAQ_ANSWER_MAX_LENGTH, "answer").optional(),
    category: z.enum(KB_CATEGORY_SLUGS).optional(),
    status: z.enum(KB_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes supplied" });

export const ALLOWED_FAQ_SORT_KEYS = ["createdAt", "updatedAt"] as const;

export const listFaqsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  category: z.enum(KB_CATEGORY_SLUGS).optional(),
  status: z.enum(KB_STATUSES).optional(),
  sort: z
    .string()
    .regex(new RegExp(`^-?(${ALLOWED_FAQ_SORT_KEYS.join("|")})$`), `sort must be one of: ${ALLOWED_FAQ_SORT_KEYS.join(", ")}, optionally prefixed with -`)
    .optional(),
});

// Public browse (Story 31 consumes this): no `status` — it is forced to
// "published" server-side and is not a caller-controllable parameter.
export const listPublicFaqsQuerySchema = paginationQuerySchema.extend({
  category: z.enum(KB_CATEGORY_SLUGS).optional(),
});

export const translateFaqFieldBodySchema = z.object({
  field: z.enum(["question", "answer"]),
  from: z.enum(["en", "ar"]),
  to: z.enum(["en", "ar"]),
  text: z.string().trim().min(1, "text is required").max(FAQ_ANSWER_MAX_LENGTH),
}).refine((v) => v.from !== v.to, { message: "from and to must differ" });
```

### 5 — `hasAnyPermission` helper

**File: `backend/src/services/permissions.ts`** — add:

```ts
// Same live-DB, no-cache, isActive-re-checking contract as hasPermission —
// for the handful of actions that are legitimately reachable by more than
// one key (e.g. the AI draft-translate assist, which is useful to both a
// create-only and an edit-only author). Callers still short-circuit `admin`
// themselves via isActiveAccount, exactly like requirePermission does.
export async function hasAnyPermission(userId: string, keys: PermissionKey[]): Promise<boolean> {
  const doc = await User.findById(userId).select("permissions isActive").lean();
  if (!doc?.isActive) return false;
  return keys.some((key) => Boolean(doc.permissions?.includes(key)));
}
```

### 6 — `faq.service.ts` — the mutation choke point

**New file: `backend/src/services/faq.service.ts`**

This is where **all** FAQ mutation logic lives. Routes do validation, permission checks, and HTTP
shaping only — they never touch `Faq` directly for a write. Two reasons: (a) the
"published needs both languages" rule must be enforced in exactly one place, reachable from every
write path; (b) it makes the future system-wide audit log a one-line addition per action rather
than a refactor (see "Future audit log").

```ts
import { Types } from "mongoose";
import { Faq, IFaq } from "../models/Faq";
import { hasBothLanguages } from "../models/localizedText";
import type { KbCategorySlug, KbStatus } from "../constants/kb";

export class FaqValidationError extends Error {}

export interface CreateFaqInput {
  question: ILocalizedText;
  answer: ILocalizedText;
  category: KbCategorySlug;
  actorId: string;
}

export interface UpdateFaqInput {
  question?: ILocalizedText;
  answer?: ILocalizedText;
  category?: KbCategorySlug;
  status?: KbStatus;
  actorId: string;
}

// The one place the bilingual publish rule is enforced. A draft may be
// half-translated; published content may never be, in either direction —
// otherwise a customer browsing in Arabic hits an English-only answer (or a
// blank one), which is exactly what Story 31's fallback path exists to
// make impossible in practice.
function assertPublishable(faq: IFaq): void {
  if (!hasBothLanguages(faq.question) || !hasBothLanguages(faq.answer)) {
    throw new FaqValidationError(
      "An FAQ must have both English and Arabic question and answer before it can be published"
    );
  }
}

export async function createFaq(input: CreateFaqInput): Promise<IFaq> { /* always status "draft" */ }
export async function updateFaq(id: string, input: UpdateFaqInput): Promise<IFaq | null> { /* applies fields, calls assertPublishable when the RESULT would be published, stamps publishedAt on first publish, sets updatedBy */ }
export async function softDeleteFaq(id: string, actorId: string): Promise<IFaq | null> { /* isDeleted = true, updatedBy = actorId */ }
```

Notes for the implementer:

- `updateFaq` must run `assertPublishable` whenever the **resulting** document would be
  `published` — i.e. on a `draft → published` transition **and** on a content edit to an
  already-published FAQ. Clearing the Arabic answer of a live FAQ must fail, not silently ship a
  blank.
- `publishedAt` is stamped on the first `draft → published` transition and **left alone** on
  unpublish/republish — it means "first went live", not "currently live".
- `FaqValidationError` maps to a 400 in the route; anything else propagates to `errorHandler`.
- Every function takes `actorId` — even `softDeleteFaq`, which barely needs it today. That
  parameter is the seam the future audit log hooks into.

### 7 — `kbAi.service.ts` — the two narrow Gemini assists

**New file: `backend/src/services/kbAi.service.ts`**

Naming/structure follows `liveChatAi.service.ts`. Everything here is built on
`gemini.service.ts`'s `generateText`, which already never throws and returns `null` on
missing-key / timeout / API error. **Nothing in this file is allowed to make a caller fail.**

```ts
import { generateText } from "./gemini.service";
import { Faq } from "../models/Faq";
import type { Language } from "../models/User";

// Deliberately shorter than gemini.service.ts's 10s default: these are
// optional conveniences inside an admin form, not a customer-facing flow,
// and an admin staring at a spinner for ten seconds is a worse outcome than
// simply not getting the suggestion. Same graceful-degradation discipline
// CLAUDE.md mandates for customer-facing flows.
const KB_AI_TIMEOUT_MS = 8_000;
```

**(a) `suggestTranslation({ text, from, to, kind })` → `Promise<string | null>`**

- Prompt: translate the given support-content string from `from` to `to`; preserve meaning and
  tone; return **only** the translation, no preamble, no quotes, no explanation. `kind`
  (`"question" | "answer"`) is a hint for register/length.
- Post-process: trim; strip a wrapping code fence or surrounding quotes if the model added one;
  return `null` if the result is empty or longer than the field's max length (better no suggestion
  than one that can't be saved).
- Returns `null` — never throws — when Gemini is unset, slow, or errors.

**(b) `findSimilarPublishedFaqs({ question, excludeId })` → `Promise<Array<{ id: string; question: ILocalizedText }>>`**

Two stages, so a Gemini outage costs nothing and one call covers the whole check:

1. **Cheap DB shortlist, no AI.** Take the 4+ character words from the new FAQ's question (either
   language), build an escaped case-insensitive regex alternation (`escapeRegex` from
   `backend/src/utils/regex.ts`), and fetch at most 20 `published`, non-deleted FAQs whose
   `question.en` or `question.ar` matches, excluding `excludeId`. If the shortlist is empty,
   **return `[]` without calling Gemini at all.**
2. **One Gemini call** listing the candidate ids + questions and the new question, asking which
   candidates (if any) mean substantially the same thing; parse a JSON array of ids out of the
   reply. On `null`, unparseable output, or any id not in the shortlist → **return `[]`**.

Returning `[]` on failure is the point: the admin simply doesn't see a warning. There is no error
state, no retry banner, and no code path in which this can block or fail a save.

### 8 — `kbFaq.routes.ts` (admin surface)

**New file: `backend/src/routes/kbFaq.routes.ts`**, mounted at `/api/v1/kb/faqs`.

Local helper, mirroring `ticketCategory.routes.ts` lines 46–56 (the third occurrence of this
idiom — keep it local, same as the existing two, rather than extracting a shared middleware):

```ts
async function callerHasPermission(req: Request, key: PermissionKey): Promise<boolean> {
  if (req.user!.role === "admin") return isActiveAccount(req.user!.id);
  return hasPermission(req.user!.id, key);
}

async function callerHasAnyPermission(req: Request, keys: PermissionKey[]): Promise<boolean> {
  if (req.user!.role === "admin") return isActiveAccount(req.user!.id);
  return hasAnyPermission(req.user!.id, keys);
}
```

Response serializer — returns **both** languages (the admin UI edits both):

```ts
function toFaqResponse(faq: IFaq) {
  return {
    id: faq.id,
    question: { en: faq.question.en, ar: faq.question.ar },
    answer: { en: faq.answer.en, ar: faq.answer.ar },
    category: faq.category,
    status: faq.status,
    publishedAt: faq.publishedAt,
    createdAt: faq.createdAt,
    updatedAt: faq.updatedAt,
  };
}
```

| Method + path | Middleware | Behaviour |
|---|---|---|
| `GET /` | `requireAuth`, `requirePermission("kb:faq_view_list")` | Parse `listFaqsQuerySchema`. Filter `{ isDeleted: { $ne: true } }` plus optional `category` / `status`, and `q` as an `escapeRegex` case-insensitive `$or` across `question.en`, `question.ar`, `answer.en`, `answer.ar`. `sortSpec` default `{ updatedAt: -1 }`. `Promise.all([find, countDocuments])`. Respond `{ faqs, total, page, limit }` — same envelope as `admin.routes.ts`. |
| `GET /:id` | `requireAuth`, `requirePermission("kb:faq_view_list")`, `validateParams(faqIdParamsSchema)` | 404 when missing or `isDeleted`. Prefills the edit form. |
| `POST /` | `requireAuth`, `requirePermission("kb:faq_create")`, `validateBody(createFaqBodySchema)` | `createFaq({ ...req.body, actorId: req.user!.id })` → **201** with `toFaqResponse`. Always a draft. |
| `PATCH /:id` | `requireAuth`, `validateParams(faqIdParamsSchema)` — **no route-level `requirePermission`** | Load the FAQ (404 if missing/deleted). Parse `updateFaqBodySchema` (400 on failure). Then: if any of `question`/`answer`/`category` is present and **not** `callerHasPermission(req, "kb:faq_edit")` → 403; if `status` is present and **not** `callerHasPermission(req, "kb:publish")` → 403. Then `updateFaq(...)`. `FaqValidationError` → 400 with its message. |
| `DELETE /:id` | `requireAuth`, `requirePermission("kb:faq_delete")`, `validateParams(faqIdParamsSchema)` | `softDeleteFaq(id, req.user!.id)` → 200 `{ id, deleted: true }`; 404 if already missing/deleted (idempotent-looking, no enumeration signal). |
| `POST /ai/translate` | `requireAuth`, `validateBody(translateFaqFieldBodySchema)` | `callerHasAnyPermission(req, ["kb:faq_create", "kb:faq_edit"])` else 403. `suggestTranslation(...)` → **always 200**, `{ translation: string \| null }`. `null` is a normal, expected response, not an error — the client renders "couldn't generate a draft right now" and the admin types it themselves. |
| `GET /:id/ai/duplicates` | `requireAuth`, `requirePermission("kb:faq_view_list")`, `validateParams(faqIdParamsSchema)` | `findSimilarPublishedFaqs({ question: faq.question, excludeId: faq.id })` → **always 200**, `{ duplicates: [...] }` (possibly empty). |

**Why the duplicate check is its own endpoint rather than part of `POST /`:** the create path then
contains **zero** external-API latency — it cannot be slowed or made flaky by Gemini at all. The
frontend calls this immediately after a successful create (and offers a "Check again" button on the
edit form); if it returns nothing, or fails, the admin never knows it ran. That is the strongest
available form of "never let a flow hang on an external API".

**Why `POST /ai/translate` is a POST and not a GET:** the source text can be several KB of answer
copy and does not belong in a URL, and it is not a cacheable read.

### 9 — `kbPublic.routes.ts` (public reads)

**New file: `backend/src/routes/kbPublic.routes.ts`**, mounted at `/api/v1/kb/public`.

**This story defines the FAQ half; Story 30 adds the article endpoints to the same file.**

```ts
// PUBLIC — no requireAuth, no requirePermission, deliberately (see
// knowledge-base Story 31's plan for the full justification: a visitor who
// can self-serve never opens a ticket, the intake calls for it, and
// CLAUDE.md's SEO section already anticipates a public knowledge-base page).
//
// This lives in its OWN router, separate from kbFaq.routes.ts, on purpose:
// the "a draft or deleted document must never leave this process" invariant
// is then one small unauthenticated file that does nothing else, instead of
// a conditional branch inside an admin router where a later edit could
// widen it by accident. Every query in this file hardcodes
// { status: "published", isDeleted: { $ne: true } } — that filter is not
// caller-controllable and there is no query parameter that can relax it.
```

| Method + path | Behaviour |
|---|---|
| `GET /faqs` | Parse `listPublicFaqsQuerySchema` (`page`, `limit`, optional `category`; **no `status`**). Query `{ status: "published", isDeleted: { $ne: true }, ...category }`, sort `{ createdAt: 1 }` (stable reading order within a category). Respond `{ faqs, total, page, limit }` where each FAQ is `{ id, question: { en, ar }, answer: { en, ar }, category, updatedAt }` — **no** `status`, **no** `publishedAt`, **no** `createdBy`. |

**Why the public endpoint returns both languages rather than resolving one server-side:** the
frontend already knows the viewer's locale server-side (the `LOCALE_COOKIE`, read in the Server
Component), so resolving there costs nothing; keeping the endpoint locale-agnostic means one
cacheable response serves both audiences, the language toggle needs no refetch, and Story 31's
fallback rendering (draft-era content missing one side) is possible at all. Payload size is not a
concern at FAQ scale.

**Rate limiting:** none exists anywhere in this codebase today, so this story does not invent it —
but note that these are the **first unauthenticated data endpoints** in the app. Flagged in Edge
Cases and in Open questions.

### 10 — Mount the routers

**File: `backend/src/app.ts`**

```ts
import kbFaqRoutes from "./routes/kbFaq.routes";
import kbPublicRoutes from "./routes/kbPublic.routes";
// ...
app.use("/api/v1/kb/faqs", kbFaqRoutes);
app.use("/api/v1/kb/public", kbPublicRoutes);
```

Distinct prefixes, so no path collision with the future `/api/v1/kb/articles` (Story 30). Remove
`knowledge-base` from the TODO comment listing unmounted routers (leave `agent-workspace`,
`sla-automation`, `ai-features`, `reports-management` intact).

---

## Frontend Tasks

All pages are authenticated/internal → `robots: { index: false, follow: false }` in every
`generateMetadata`, per `CLAUDE.md`'s SEO section. All mutations go through Server Actions with
`zod` validation **inside the action** and per-field errors; all form inputs are **controlled**
(`useState` + `value`/`onChange`) — never bare `defaultValue`.

### 11 — Nav entry

**File: `frontend/lib/staffNav.ts`** — add to `STAFF_NAV_ITEMS`:

```ts
{ key: "kbFaqs", href: "/admin/kb/faqs", icon: MessagesSquare, staffOnly: true, agentOrAdminOnly: false, permission: "kb:faq_view_list" },
```

(Confirm `MessagesSquare` exists in the installed `lucide-react`; fall back to `HelpCircle`.)
Gated on the exact key its own `GET` requires, matching the `accounts` / `chats` / `customers`
precedent — a viewer who'd just get a 403 is never offered the link. Add `"kbFaqs": "FAQs"` to the
`Nav` section of both message files (`StaffSidebar`/`MobileStaffNav` render `t(item.key)`).

**Nothing is added to `STAFF_ACTION_ITEMS`** — see "Deliberate exclusions".

### 12 — FAQ list page

**New file: `frontend/app/admin/kb/faqs/page.tsx`** (Server Component)

Mirror `frontend/app/admin/users/page.tsx` end to end:

- `searchParams: Promise<{ page?, q?, category?, status?, sort?, _refreshed? }>`; build
  `currentQuery` from every filter, derive `nextUrl` from it, and **forward every one of those
  params to the backend fetch** — a param in the filter bar and the schema but missing from the
  fetch silently no-ops.
- Session: `SESSION_COOKIE` / `REFRESH_COOKIE`, `_refreshed` one-shot guard, 401 → refresh
  redirect, 403 → `redirect("/dashboard")` (never a dead-end message page), `!res.ok` →
  `redirect("/")`.
- `GET ${API_URL}/api/v1/kb/faqs?<currentQuery>&page=&limit=10`, `cache: "no-store"`.
- Permission flags from `peekJwtPayload(token)`:

  ```ts
  const isViewerAdmin = viewerRole === "admin";
  const canCreate  = isViewerAdmin || viewerPermissions.includes("kb:faq_create");
  const canEdit    = isViewerAdmin || viewerPermissions.includes("kb:faq_edit");
  const canDelete  = isViewerAdmin || viewerPermissions.includes("kb:faq_delete");
  const canPublish = isViewerAdmin || viewerPermissions.includes("kb:publish");
  const showActionsColumn = canEdit || canDelete || canPublish;
  ```

  The "New FAQ" button renders only when `canCreate`. Controls are **hidden**, not disabled.
- Columns: **Question** (the viewer's locale via `pickLocalized`, truncated), **Languages** (two
  small badges `EN` / `AR` — filled when that language is present, `variant="outline"` +
  `text-muted-foreground` when missing; this is the at-a-glance "is this translated yet" signal
  that makes the draft workflow legible), **Category** (`t(\`KbCategories.${row.category}\`)`),
  **Status** (`published` → `Badge` with the `success` tokens, exactly the `statusActive` styling
  in `admin/users/page.tsx` lines 209–215; `draft` → `variant="secondary"`), **Updated**
  (`new Date(row.updatedAt).toLocaleDateString()`), **Actions**.
- Mobile (`md:hidden`) stacked cards + desktop table, same split as the users roster.
- `<ListPagination total page limit hrefForPage />` where `hrefForPage` preserves `currentQuery`.
- Empty state: `t("empty")`.
- Use theme tokens throughout (`text-muted-foreground`, `bg-success/10 text-success`,
  `border-border`) — **no hardcoded hex**.

**New file: `frontend/app/admin/kb/faqs/FaqFilterBar.tsx`** (Client Component) — a direct
adaptation of `AdminUsersFilterBar.tsx`: `FilterField`-wrapped `Select`s for **Category** and
**Status** plus a **Sort** select (`-updatedAt` / `updatedAt` / `-createdAt` / `createdAt`), the
`__all__` sentinel, `params.delete("page")` on every change, the active-filter highlight classes,
the clearable `q` chip, and the reset button **in its own row outside the flex-wrap**, `variant="ghost"`
with `text-destructive hover:bg-destructive/10 hover:text-destructive`.

**File: `frontend/components/HeaderSearch.tsx`** — add `"/admin/kb/faqs": "searchFaqsFor"` to
`PAGE_SEARCH_TARGETS`, and `"searchFaqsFor": "Search FAQs for \"{query}\""` to the `Nav` section of
both message files. This is the per-list "search this page" affordance required by the standard
list-view pattern — it is **not** the global action index, and adding it does not contradict the
exclusion below (see "Deliberate exclusions" for why these two are different surfaces).

### 13 — Row actions

**New file: `frontend/app/admin/kb/faqs/ConfirmActionButton.tsx`** — a route-local copy of
`frontend/app/admin/ticket-categories/ConfirmActionButton.tsx`, with the same header comment
explaining that this project deliberately keeps these colocated per route rather than promoting
them to `frontend/components/`. **Do not** refactor the three copies into one — that convention is
already stated in the existing file and is not this story's to overturn.

**New file: `frontend/app/admin/kb/faqs/RowActions.tsx`** (Client Component), modelled on
`admin/users/RowActions.tsx`:

- `canEdit` → `Pencil` icon link to `/admin/kb/faqs/${id}/edit`.
- `canPublish` → when `status === "draft"`, a `ConfirmActionButton` (`Send`/`Globe` icon,
  `successful`) calling `publishFaq(id)`; when `status === "published"`, one (`EyeOff` icon)
  calling `unpublishFaq(id)`. Publish/unpublish is confirmed because it changes what every
  customer sees.
- `canDelete` → a destructive `ConfirmActionButton` (`Trash2`) calling `deleteFaq(id)`, whose
  confirm body says the FAQ is **hidden everywhere but recoverable by a developer**, not
  "permanently deleted" — the copy must not lie about a soft delete.

### 14 — Server Actions

**New file: `frontend/app/admin/kb/faqs/actions.ts`** (`"use server"`)

Follow `frontend/app/admin/ticket-categories/actions.ts` exactly: `getBearerToken()` (cookie →
`refreshSession()` fallback), `doFetch(bearer)` + **retry once on 401**, `mapBackendError(status,
data)` translating the backend's known English strings into i18n copy, `revalidatePath`, and a
`{ error: string | null; fieldErrors?: Record<string, string[]> }` state shape.

- `createFaqAction(prevState, formData)` — `zod` schema
  `{ questionEn, questionAr, answerEn, answerAr, category }`, refined so each of question/answer
  has at least one language; returns `.flatten().fieldErrors` on failure. Assembles the
  `{ question: { en, ar }, answer: { en, ar }, category }` body. On success returns the new id (the
  form then runs the duplicate check and redirects to the edit page).
- `updateFaqAction(id, prevState, formData)` — same schema, `PATCH`.
- `publishFaq(id)` / `unpublishFaq(id)` — `PATCH` with `{ status }`. Must surface the backend's
  "both languages" 400 as a specific translated message (`errorNeedsBothLanguages`), because that
  is the single most likely real failure an admin will hit.
- `deleteFaq(id)` — `DELETE`.
- `translateFaqField({ field, from, to, text })` — `POST /ai/translate`; returns
  `{ translation: string | null }`. **Never** returns an error state for a `null` translation.
- `checkFaqDuplicates(id)` — `GET /:id/ai/duplicates`; returns `{ duplicates: [...] }`, and `[]` on
  any failure.

All of these `revalidatePath("/admin/kb/faqs")`. `publishFaq` / `unpublishFaq` / `updateFaqAction` /
`deleteFaq` additionally `revalidatePath("/help")` — the public browse page Story 31 adds is
`revalidate`-cached, so a publish must invalidate it. (Harmless before Story 31 exists; wire it now
so Story 31 doesn't have to come back and edit this file.)

### 15 — Create / edit forms

**New files:**
- `frontend/app/admin/kb/faqs/new/page.tsx` + `NewFaqForm.tsx`
- `frontend/app/admin/kb/faqs/[id]/edit/page.tsx` + `EditFaqForm.tsx`

Both pages are Server Components that read the session, fetch (edit only) `GET /kb/faqs/:id`,
handle 401/403 the same way as the list page, and export `generateMetadata` with
`robots: { index: false, follow: false }`.

**`BilingualFieldEditor` — new file `frontend/app/admin/kb/faqs/BilingualFieldEditor.tsx`** (Client
Component), shared by both forms and the thing Story 30 reuses:

- A `Tabs` (already installed) with two tabs, **English** and **العربية**. Each tab holds one
  controlled `Input` (question) or `Textarea` (answer). The Arabic pane sets `dir="rtl"`
  `lang="ar"` on its field — regardless of the admin's own UI locale, since they may be authoring
  Arabic while working in an English UI.
- Each tab label carries a small dot/badge showing whether that language is filled, so "what's
  still missing" is visible without switching tabs.
- Under the **empty** side, a **"Draft translation with AI"** button (`Sparkles` icon), enabled
  only when the *other* language has text. On click: `useTransition` → `translateFaqField(...)`.
  - On a string result: write it into the empty field **as an ordinary editable value** and show a
    dismissible `Alert` reading `t("aiDraftNotice")` — "Machine-drafted. Review before publishing."
    The admin can edit or clear it like any other typed text; there is no separate "accepted" state
    and nothing auto-saves.
  - On `null`: show a quiet muted line `t("aiUnavailable")` and nothing else. **No error styling,
    no retry loop, no blocked submit.**
- The button is never required to submit. A form with the AI entirely unavailable behaves exactly
  as if the button weren't there.

**`NewFaqForm.tsx`**: `useActionState(createFaqAction, ...)`, controlled state for all five fields
(`questionEn`, `questionAr`, `answerEn`, `answerAr`, `category`), the `BilingualFieldEditor` twice,
a `Select` for category (options from a `KB_CATEGORY_SLUGS` mirror in
`frontend/lib/kb.ts`, labelled via `t(\`KbCategories.${slug}\`)`), and a submit button reading
**"Save as draft"** — the copy must make it obvious that creating never publishes. Render both
`state.error` and `state.fieldErrors`. On success, call `checkFaqDuplicates(newId)` and route to
the edit page carrying the result.

**`EditFaqForm.tsx`**: same fields prefilled from the fetched FAQ, plus:
- A status line ("Draft" / "Published <date>") and, when `canPublish`, a **Publish** /
  **Unpublish** button. **Publish is disabled with an explanatory hint** when either field is
  missing a language — the client-side mirror of the server rule, so the admin sees *why* rather
  than getting a 400. The server check is still the real boundary.
- A **duplicate-warning `Alert`** (`variant="default"`, warning tokens — never `destructive`, it is
  not an error) listing similar published FAQs as links to their edit pages, shown when
  `checkFaqDuplicates` returned any. Dismissible. Renders **nothing at all** when the check
  returned `[]`, whether that's because there genuinely are no duplicates or because Gemini was
  unavailable — the two cases are deliberately indistinguishable to the admin, so an outage is
  invisible rather than alarming. A **"Check for duplicates"** button re-runs it on demand.

**New file: `frontend/lib/kb.ts`** — mirrors `backend/src/constants/kb.ts`'s slug list and status
union for the frontend, with the same "keep in lockstep" header comment
`frontend/lib/permissions.ts` already uses.

### 16 — i18n

**Files: `frontend/messages/en.json` and `frontend/messages/ar.json` — both, in the same change.**

New sections (place them together, after the existing `AdminTicketCategories`/`NewTicketCategory`
block so the KB sections stay adjacent as Stories 30 and 31 add more):

- `KbCategories` — one key per slug in `KB_CATEGORY_SLUGS`. **Shared** by the admin forms, the
  filter bars, and Story 31's public browse page; do not duplicate it per section.
- `AdminFaqs` — list page: `heading`, `addFaq`, `colQuestion`, `colLanguages`, `colCategory`,
  `colStatus`, `colUpdated`, `colActions`, `statusDraft`, `statusPublished`, `langEn`, `langAr`,
  `langMissing`, `filterCategory`, `filterStatus`, `filterAll`, `filterSearch`, `searchingFor`,
  `resetFilters`, `sortLabel`, `sortUpdatedDesc`, `sortUpdatedAsc`, `sortCreatedDesc`,
  `sortCreatedAsc`, `empty`, `edit`, `publish`/`publishConfirm*`, `unpublish`/`unpublishConfirm*`,
  `delete`/`deleteConfirm*`, `noAccess`, `genericError`, `errorNeedsBothLanguages`.
- `FaqForm` — shared by the new and edit forms: `newHeading`, `editHeading`, `question`, `answer`,
  `category`, `tabEnglish`, `tabArabic`, `languageFilled`, `languageMissing`, `saveDraft`,
  `saveChanges`, `saving`, `publish`, `unpublish`, `publishNeedsBothLanguages`, `aiTranslate`,
  `aiTranslating`, `aiDraftNotice`, `aiUnavailable`, `duplicateWarningTitle`,
  `duplicateWarningBody`, `checkDuplicates`, `dismiss`, plus per-field validation messages
  (`questionRequired`, `answerRequired`, `categoryRequired`, `tooLong`).
- `Nav` additions: `kbFaqs`, `searchFaqsFor`.
- `Permissions.keys` additions: the four new keys (Task 1), plus the reworded `kb:publish`.

Arabic must be real translations, not English placeholders — `ar.json` is live and every key in
`en.json` has a counterpart today. Do not let them drift.

---

## Deliberate exclusions — notifications and global search

**These are decisions the user made explicitly. A future reviewer would otherwise flag both as
gaps against this repo's own conventions. Do not "fix" them without asking.**

### No in-app notifications for KB admin actions

This repo has a strong convention (`backend/src/services/notification.service.ts`,
`frontend/components/NotificationBell.tsx`) that consequential actions notify whoever they affect —
`createTicketNotification` for an assignee, `notifyTicketOversight` / `notifyChatOversight` for
admins and permission-holding sub-admins/agents.

**Creating, editing, publishing, unpublishing, or deleting an FAQ fires no notification of any
kind.** No `NotificationType` value is added, `notification.service.ts` is not imported by
`faq.service.ts`, and nothing is written to the `Notification` collection.

*Reasoning (the user's, recorded so it isn't relitigated):* the notification surface exists to tell
a specific person that something now needs their attention or has changed under them — a ticket
landed in their queue, a chat escalated, a ticket they own moved. KB authoring has no such
counterparty: nobody is waiting on an individual FAQ, and no one's work is blocked by one. Wiring
these in would turn the bell into a low-signal content-changelog feed and dilute the events that
genuinely need a response. If a "what changed in the KB recently" view is ever wanted, the future
system-wide audit log (below) is the right home for it — not per-user notifications.

### No global quick-search / command-palette entries for KB admin actions

Two distinct surfaces live in `frontend/components/HeaderSearch.tsx`, and the distinction decides
this:

1. **The quick-jump nav + action list** (lines 49–52), built from `visibleStaffNavItems()` and
   `visibleStaffActionItems()` in `frontend/lib/staffNav.ts` — the ⌘K "go somewhere / create
   something" index.
2. **The per-page list search** (`PAGE_SEARCH_TARGETS`, lines 15–19) — an affordance that re-runs
   *the current list page's own* `?q=` server-side filter. It is not an index of anything; it is
   part of the standard list-view pattern every admin list in this repo implements.

**This story adds one entry to `STAFF_NAV_ITEMS`** (the FAQ list page, gated on
`kb:faq_view_list`) — a page that isn't reachable from the nav rail violates `CLAUDE.md`'s "don't
build a page only reachable via another page's ad hoc links", and that entry is a *destination*,
exactly like Customers and Accounts.

**This story adds nothing to `STAFF_ACTION_ITEMS`.** There is no "New FAQ" quick action in ⌘K.
KB authoring is deliberate, low-frequency, planned work — an admin sits down to write FAQs, they
don't dash off one mid-ticket the way they create a ticket or a customer. Adding it would push a
genuinely high-frequency action (New ticket) further down the list to no benefit.

**And it adds `PAGE_SEARCH_TARGETS["/admin/kb/faqs"]`**, because that is the list-view pattern, not
the action index.

**The unused `cmdk`-based `frontend/components/ui/command.tsx` primitive stays unused.** If a real
global command palette is ever built, KB admin actions must **not** be indexed into it — same
reasoning as above. Note that explicitly in whatever story builds it.

*(Customer-facing knowledge-base **search** — a different thing entirely from either surface here —
is `USER_STORIES.md` Story 31 and remains unbuilt.)*

---

## Future audit log — keep in mind, do not build

The user is separately planning a **cross-cutting, system-wide audit log**: one entry for every
consequential action anywhere in the platform (a customer logging in, an agent going online, an
admin publishing an article). `backend/src/constants/permissions.ts` already reserves `audit:view`
for it, and `USER_STORIES.md` Story 47 ("Review audit logs") is its backlog home.

**1. Out of scope here.** This story does not create an `AuditLog` model, does not stub one, does
not add a `logAudit()` call, and does not design the entry shape. That is a separate planning
exercise the user will run when ready, and guessing at the schema now would just be something to
undo.

**2. What this story *does* do so that hooking it up later is a one-line change per action:** every
FAQ mutation goes through a **single choke-point function** in
`backend/src/services/faq.service.ts` — `createFaq`, `updateFaq`, `softDeleteFaq` — and **every one
of them takes `actorId`**, even where it is barely used today. No route handler mutates a `Faq`
document directly. When the audit log lands, each of those three functions gains one call at the
end; nothing needs restructuring, and there is no way for a write path to bypass it, because there
is no other write path. Story 30 must keep the same discipline in `helpArticle.service.ts`.

**3. The in-repo shape worth being consistent with, for whoever plans that story.** The closest
existing thing is `backend/src/models/Ticket.ts` lines 21–58: five parallel **append-only** arrays
(`statusHistory`, `categoryHistory`, `priorityHistory`, `assignedAgentHistory`,
`chatPresenceHistory`), each entry `{ <the new value>, changedBy: ObjectId, changedAt: Date }`,
embedded on the document they describe. Two observations for the future planner, offered as input,
not as a decision:

- The `{ newValue, changedBy, changedAt }` triple is the field vocabulary this codebase already
  reads naturally, and its own comment (line 75) anticipates being migrated into a real history
  collection later — so a generic log that keeps those three field names would let
  `ticketHistory.service.ts`'s `buildTicketHistory` be folded in without renaming anything.
- Embedding-per-document does **not** generalise to a system-wide log (a customer login belongs to
  no document, and "show me everything that happened last Tuesday" can't be answered by scanning
  every collection's arrays). A standalone collection with a stable actor/action/target triple is
  almost certainly the right shape — but that call belongs to the audit-log story, not this one.

**4. `createdBy` / `updatedBy` on `Faq` are not an audit trail.** They are current-state
convenience fields ("who last touched this"), same as `Ticket.createdBy`. They record no history,
overwrite on every edit, and must not be mistaken for, or grown into, the log.

---

## Edge Cases & Failure Modes

- **Publishing with one language missing** → 400 from `assertPublishable`, surfaced as
  `errorNeedsBothLanguages`. The frontend also disables the Publish button with a hint, but the
  server check is the real boundary (a raw `PATCH` must be rejected).
- **Editing a *published* FAQ down to one language** → same 400. Clearing the Arabic answer of a
  live FAQ must not silently ship a blank to Arabic-locale customers.
- **`POST /kb/faqs` with `status: "published"` in the body** → the field is not in
  `createFaqBodySchema`, so zod strips it and the FAQ is created as a draft. This is the intended
  behaviour, not a silent failure — it is what stops `kb:faq_create` from bypassing `kb:publish`.
  Assert it in a test.
- **`PATCH` by an account with `kb:faq_edit` but not `kb:publish`, sending `{ status }`** → 403,
  standard `{ error: "You do not have permission to perform this action" }`. And vice versa: an
  account with only `kb:publish` sending `{ question }` → 403.
- **`PATCH` sending both content and `status` with only one of the two keys** → 403; the whole
  request is rejected, nothing is partially applied (both checks run before any mutation).
- **A deactivated sub-admin's unexpired token** → `requirePermission` / `callerHasPermission` both
  re-check `isActive` on a live DB read (`services/permissions.ts`), so it fails immediately rather
  than at token expiry. The same must be true of the new `hasAnyPermission` — it re-checks
  `isActive` for exactly this reason; do not "optimise" that lookup away.
- **A `customer`-role token calling any `/api/v1/kb/faqs*` endpoint** → 403 (`requirePermission`
  rejects any role other than admin/agent/subadmin). Customers reach KB content only through
  `/api/v1/kb/public/*`.
- **Gemini not configured (`GEMINI_API_KEY` unset)** → `generateText` logs a warning and returns
  `null`; `suggestTranslation` returns `null` (form shows the muted "unavailable" line),
  `findSimilarPublishedFaqs` returns `[]` (no warning rendered). Both forms remain fully usable.
  **Add a backend test that asserts this explicitly** — a mocked `generateText` returning `null`
  must not produce a non-2xx response anywhere.
- **Gemini returns garbage** (prose instead of a translation, non-JSON instead of an id array) →
  `suggestTranslation` returns it as editable text (the admin can see and delete it), which is
  acceptable; `findSimilarPublishedFaqs` returns `[]` on any parse failure, and **discards any id
  not in the shortlist it sent** — a hallucinated id must never become a link in the admin UI.
- **Duplicate-check shortlist is empty** → return `[]` without calling Gemini at all. Avoids a
  pointless API call on the first FAQ ever created (and on every genuinely novel one).
- **Soft-deleted FAQ** → excluded from the admin list, `GET /:id`, and every public read. A
  `DELETE` on an already-deleted id → 404, indistinguishable from a nonexistent id (no enumeration
  signal), matching the repo's existing not-found discipline.
- **Category slug removed from `KB_CATEGORY_SLUGS` in a later code change while documents still
  reference it** → those documents fail the enum on their next `save()`, and the frontend's
  `t(\`KbCategories.${slug}\`)` throws a missing-message error. **Never remove a slug**; add new
  ones and stop offering the old one in the picker if it must be retired. Note this in the
  constant's comment.
- **RTL/Unicode content** → stored unnormalised, same as every other user-entered string in this
  codebase. Rendering correctness depends on `dir`/`lang` being set per field (Task 15) and per
  content block (Story 31), not on storage.
- **`escapeRegex` on the admin `q` filter** — mandatory. A `q` of `.*` or `(((` must not become a
  catastrophic regex; reuse `backend/src/utils/regex.ts`, do not hand-build the pattern.
- **Unauthenticated `/api/v1/kb/public/faqs` traffic** → the first unauthenticated data endpoint in
  the app. Reads are published-only and non-sensitive, and the query surface is a bounded enum plus
  pagination (nothing free-text, so nothing regex-injectable), but there is **no rate limiting
  anywhere in this codebase** to inherit. Flagged, not solved here — see Open questions.

---

## Test Plan

Runner is **Vitest** (`backend/vitest.config.ts`, `globals: true`, tests under `backend/tests/`,
`npm test`), with `supertest` against `createApp()` and `mongodb-memory-server`.

**New file: `backend/tests/routes/kbFaq.routes.test.ts`**

1. **Auth gate** — `GET /api/v1/kb/faqs` with no `Authorization` → 401.
2. **Role gate** — as a `customer` token → 403.
3. **Permission gate** — as a `subadmin` with `[]` permissions → 403; with `["kb:faq_view_list"]`
   → 200.
4. **Deactivated holder** — a subadmin holding `kb:faq_view_list` but `isActive: false` → 403
   (proves the live `isActive` re-check).
5. **Create** — with `kb:faq_create` → 201, `status === "draft"`, `publishedAt === null`,
   `createdBy` set.
6. **Create cannot publish** — body includes `status: "published"` → still created as `"draft"`.
7. **Create with only English** → 201 (drafts may be half-translated).
8. **Create with neither language on `question`** → 400.
9. **Create with an unknown category** → 400.
10. **Edit content** — with `kb:faq_edit` → 200, `updatedBy` set, `updatedAt` advanced.
11. **Edit content without `kb:faq_edit`** (holding only `kb:publish`) → 403.
12. **Publish with both languages** — with `kb:publish` → 200, `status === "published"`,
    `publishedAt` stamped.
13. **Publish with one language missing** → 400 with the both-languages message.
14. **Publish without `kb:publish`** (holding only `kb:faq_edit`) → 403.
15. **Unpublish then republish** → `publishedAt` unchanged from the first publish.
16. **Edit a published FAQ down to one language** → 400.
17. **Mixed PATCH** (`{ question, status }`) holding only one of the two keys → 403, and the FAQ is
    unchanged in the DB (nothing partially applied).
18. **Delete** — with `kb:faq_delete` → 200; the FAQ disappears from `GET /` and `GET /:id` (404)
    but the document still exists with `isDeleted: true`.
19. **Delete twice** → second call 404.
20. **List filters** — seed a spread of categories/statuses; assert `category`, `status`, `q`
    (matching Arabic text as well as English), `sort`, and `page`/`limit` each narrow correctly and
    the `{ faqs, total, page, limit }` envelope is exact.
21. **`q` with regex metacharacters** (`.*`, `(((`) → 200, treated literally, no crash.
22. **`admin` role** — passes every one of the above with an empty `permissions` array.

**New file: `backend/tests/routes/kbPublic.routes.test.ts`**

23. `GET /api/v1/kb/public/faqs` with **no** `Authorization` → 200.
24. Returns only `published`, non-deleted FAQs; a draft and a soft-deleted FAQ are both absent.
25. Response objects contain **no** `status`, `publishedAt`, `createdBy`, or `updatedBy`.
26. `?status=draft` (a hand-crafted attempt) is ignored — response is still published-only.
27. `?category=` narrows; an unknown category → 400.
28. Both `en` and `ar` are present on every returned field.

**New file: `backend/tests/services/kbAi.service.test.ts`** (mock `./gemini.service`)

29. `generateText` → `null` ⇒ `suggestTranslation` returns `null` and does not throw.
30. `generateText` → a fenced/quoted string ⇒ the fence/quotes are stripped.
31. `generateText` → a string longer than the field max ⇒ `null`.
32. Empty shortlist ⇒ `findSimilarPublishedFaqs` returns `[]` **and `generateText` was never
    called** (assert the mock's call count).
33. `generateText` → non-JSON ⇒ `[]`.
34. `generateText` → a JSON array containing an id **not** in the shortlist ⇒ that id is dropped.
35. Route-level: `POST /ai/translate` with `generateText` mocked to `null` → **200** with
    `{ translation: null }`, not a 5xx.

`cd backend && npm run typecheck` must pass with **no new `any`** — `ILocalizedText`, `KbStatus`,
`KbCategorySlug`, and the zod-inferred body types cover every value.

**Frontend:** no test runner exists yet (`CLAUDE.md`, "Testing") — verify manually below.

---

## Migration / Rollback

- **Purely additive.** One new collection (`faqs`), five new permission keys, three new routers
  mounted at previously-unused prefixes, one reworded i18n label. No existing document, schema,
  route, or page changes shape.
- **No backfill.** `kb:publish` was reserved but never granted or enforced; any account that
  somehow holds it simply starts being able to publish, which is what it always meant.
- **Rollback:** delete `backend/src/models/Faq.ts`, `localizedText.ts`, `constants/kb.ts`,
  `validation/kbFaq.schema.ts`, `services/faq.service.ts`, `services/kbAi.service.ts`,
  `routes/kbFaq.routes.ts`, `routes/kbPublic.routes.ts`; revert the `app.ts` mounts + TODO comment,
  the `permissions.ts` key additions (frontend and backend), the `hasAnyPermission` addition, the
  `staffNav.ts` entry, the `HeaderSearch.tsx` `PAGE_SEARCH_TARGETS` entry, and both message files;
  delete `frontend/app/admin/kb/` and `frontend/lib/kb.ts` / `frontend/lib/localized.ts`. Drop the
  `faqs` collection. Any account granted a `kb:faq_*` key would then hold an unknown key — harmless
  (`hasPermission` just never matches it) but worth a cleanup pass.

---

## Verification Steps

1. `cd backend && npm run typecheck` → exit 0.
2. `cd backend && npm test` → every case above passes.
3. `cd backend && npm run build` → clean `tsc`.
4. `cd backend && npm run dev`; `GET /api/v1/health` still 200.
5. **Route smoke, admin JWT:** `POST /api/v1/kb/faqs` (English only) → 201 draft;
   `PATCH .../:id { status: "published" }` → **400**; fill the Arabic and repeat → 200;
   `GET /api/v1/kb/public/faqs` **with no auth header at all** → the FAQ appears, with no `status`
   field; `DELETE .../:id` → 200, then the public list is empty again.
6. **Permission smoke:** create a sub-admin holding only `kb:faq_view_list` — the list loads, and
   `POST`/`PATCH`/`DELETE` all 403. Grant `kb:faq_create` — create works, publish still 403.
7. `cd frontend && npm run build` → no type errors.
8. **Manual UI:** as admin, the sidebar shows **FAQs**; `/admin/kb/faqs` lists with working
   category/status/sort filters, the ⌘K "Search FAQs for …" affordance sets `?q=`, the reset button
   sits on its own row and clears everything, and pagination works. Create an English-only FAQ; the
   language badges show `EN` filled / `AR` missing; **Publish is disabled with a hint**. Use
   **Draft translation with AI**, edit the result, publish → the status badge flips to Published.
   Toggle the UI to Arabic (user menu) and confirm the whole page mirrors RTL and the FAQ list
   renders the Arabic question.
9. **Permission-hiding smoke:** sign in as a sub-admin holding only `kb:faq_view_list` — no
   "New FAQ" button, no Actions column at all (not a column of greyed-out icons).
10. **Gemini-off smoke:** unset `GEMINI_API_KEY`, restart, and repeat step 8 — the AI button shows
    the quiet "unavailable" line, **no error toast, no blocked save**, and the whole create/publish
    flow still completes.
11. **Regression:** `/admin/users`, `/admin/ticket-categories`, `/customers`, `/tickets` all
    unchanged; ⌘K still offers the same quick-create actions as before (no new ones).

---

## Done Criteria

- [ ] `ILocalizedText` + `localizedTextSchema` exist in `backend/src/models/localizedText.ts`, reuse
      `Language` from `models/User.ts`, and are the only bilingual-content shape in the codebase.
- [ ] `Faq` model stores `question`/`answer` bilingually in one document, with `category`, `status`,
      `publishedAt`, `isDeleted`, `createdBy`/`updatedBy`, and `timestamps: true`.
- [ ] `kb:faq_view_list` / `kb:faq_create` / `kb:faq_edit` / `kb:faq_delete` exist in both the
      backend and frontend permission vocabularies, are in both `SUBADMIN_ONLY_PERMISSIONS` sets,
      and are labelled in `en.json` + `ar.json`; **`kb:publish` is reused, not duplicated**, and its
      label now reads "content" rather than "articles".
- [ ] `POST /kb/faqs` cannot create published content; `PATCH` splits `kb:faq_edit` vs `kb:publish`
      per changed field; publishing requires both languages on both fields.
- [ ] `GET /api/v1/kb/public/faqs` serves published, non-deleted FAQs with **no auth**, in its own
      router, and cannot be coaxed into returning a draft by any parameter.
- [ ] All FAQ mutations go through `services/faq.service.ts`, each taking `actorId`; no route
      handler writes a `Faq` document directly.
- [ ] Gemini draft-translate and duplicate-flag both work, are optional, never block a save, and are
      silently absent when Gemini is unavailable — proven by a test with `generateText` mocked to
      `null`.
- [ ] `/admin/kb/faqs` implements the standard list-view pattern (URL-driven pagination + filters,
      every param forwarded to the backend fetch, `ListPagination`, filter bar with the reset button
      in its own row, `HeaderSearch` page-search target) and hides every control the viewer's
      permissions don't cover.
- [ ] Create/edit forms use controlled inputs, validate with `zod` **inside** the Server Action and
      return per-field errors, and set `dir`/`lang` correctly on the Arabic fields.
- [ ] Every new user-facing string is in **both** `en.json` and `ar.json`; no hardcoded English in
      any component; no hardcoded hex colours.
- [ ] **No** notification is fired and **no** `STAFF_ACTION_ITEMS` / command-palette entry is added
      for any KB admin action, and both exclusions are documented in code comments where a reviewer
      would look.
- [ ] No `AuditLog` model, stub, or call exists.
- [ ] `npm run typecheck` + `npm test` (backend) and `npm run build` (frontend) all pass clean.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 30
(write-and-organize-help-articles).**

---

## Open questions for the user

1. **Fixed vs. admin-managed KB categories.** This plan uses a fixed code-level slug list
   (Design decision 3) so adding a category is a code change, not an admin action. The alternative
   is a `KbCategory` collection mirroring `TicketCategory` — but with bilingual names and four more
   permission keys, i.e. a third CRUD surface inside a story scoped as "just UI and forms". The
   migration path is open either way. **Is the fixed list acceptable for now?** And is the proposed
   starter vocabulary right — `getting-started`, `account-and-profile`, `tickets-and-support`,
   `live-chat`, `billing-and-payments`, `troubleshooting`, `privacy-and-security`?
2. **Rate limiting on the public endpoints.** `GET /api/v1/kb/public/*` are the first
   unauthenticated data endpoints in this codebase, and there is no rate-limiting middleware
   anywhere to inherit. The exposure is low (published, non-sensitive content; bounded enum + page
   params), so this plan does **not** add one. Do you want a basic limiter introduced here, or
   deferred to a platform-level story that covers the whole API at once?
3. **Should a published FAQ ever be hard-deletable?** This plan only soft-deletes, so a deleted FAQ
   is invisible but recoverable by a developer, and the delete-confirmation copy says so. If you
   want a real "purge" (e.g. for content published by mistake that must not persist), that is a
   second action and, by this repo's granularity convention, a sixth permission key — say the word
   and it goes in Story 30's scope alongside the article equivalent.
