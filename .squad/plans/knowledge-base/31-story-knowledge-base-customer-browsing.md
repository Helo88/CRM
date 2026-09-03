# Story 31 — Knowledge-base customer browsing (pulled forward from Story 38)

> **Hand-authored plan**, same as Stories 29 and 30 — squad-kit's generator was deliberately not
> used for this feature.
>
> **AMENDMENT (2026-09-02).** `/help` uses a **tab switch between FAQs and Guides**
> (plain `?tab=faqs|articles` links, server-rendered, no JS needed), not the single
> stacked page described in "Design decision 3" below — the direction chosen when
> reviewing this page's UI concepts. Everything else (the Accordion for FAQs, `Card`s
> for articles, `/help/[slug]` as the only detail page, the category-filter links, the
> reachability wiring) was implemented as written. Also: there is no draft/published
> state any more (see Story 29's amendment) — the public endpoints filter on
> `isDeleted` only, not `status`.
>
> **This story has no intake file, and its `NN` does not correspond to `USER_STORIES.md` Story 31
> ("Search the knowledge base").** It is a **deliberate, user-made scope decision** to pull the
> *browse* half of `customer-portal` **Story 38 ("Browse FAQs from the portal")** forward, ahead of
> the recommended build order (`knowledge-base` → `ai-features` → `customer-portal`). The reason is
> plain: Stories 29 and 30 build a complete admin authoring surface for content **no customer can
> see**, which is exactly the failure `CLAUDE.md`'s "ship the frontend in the same story" convention
> exists to prevent — the platform would have a working knowledge base and no way for a human to
> read it, the same mistake Stories 1–2 made with auth. **This is not an oversight or an
> out-of-order accident; do not "correct" it back into `customer-portal`.**
>
> The file is numbered `31` to sit third in this feature folder, alongside the two stories it
> depends on. When Story 38 proper is planned under `customer-portal`, its plan must open by
> recording that this part of its scope is already built here and that only the remainder (below)
> is left.

## What this story does NOT take from Story 38

Story 38's acceptance criteria in `USER_STORIES.md` are:

| Story 38 criterion | Here? |
|---|---|
| "Knowledge base is accessible directly from the portal home screen." | **Yes** — a link from `/support` (the customer portal home, `frontend/app/support/page.tsx`) and from the site header. |
| "FAQs display in the customer's selected language (English/Arabic)." | **Yes** — the core of this story. |
| "Portal suggests relevant articles before the customer finishes submitting a new ticket." | **No — explicitly excluded.** |

**The ticket-submission cross-link is deliberately out of scope.** It hangs off the
ticket-submission flow (`frontend/app/tickets/new/`), needs a relevance mechanism that does not
exist yet, and is a different interaction (interruptive suggestion during a form) from browsing.
Building it here would either hardcode a naive keyword match that Story 31-proper's real search and
Story 35's AI ranking would both immediately replace, or drag one of those stories in whole. It
stays for **Story 38 proper, or a follow-up** — noted so a reviewer doesn't read this plan as a
complete delivery of Story 38.

**Also out of scope:** `USER_STORIES.md` **Story 31, "Search the knowledge base"** — ranked
bilingual keyword results across FAQs and articles, with no-result logging so content gaps surface.
This story ships **browse + category filter only**, no `?q=` anywhere on the public surface. (The
admin lists' `q` filter from Stories 29/30 is a list filter, a different thing.) See Open questions
— a plain client-side filter is offered as an option if you'd rather not wait.

**Also out of scope:** anything agent-facing (Story 35's AI-suggested KB solutions), any
authenticated per-customer state (bookmarks, "was this helpful?" voting, view counts), and any
`robots.ts`/`sitemap.ts` site-wide file (see Open questions — that is platform-feature scope per
`CLAUDE.md`).

---

## Prerequisites

- **Stories 29 and 30 must both be complete.** This story is **frontend-only plus one small backend
  addition** — every endpoint it consumes already exists:
  - `GET /api/v1/kb/public/faqs?category=&page=&limit=` (Story 29)
  - `GET /api/v1/kb/public/articles?category=&page=&limit=` (Story 30)
  - `GET /api/v1/kb/public/articles/:slug` (Story 30)

  All three are **unauthenticated**, hardcoded to `{ status: "published", isDeleted: { $ne: true } }`,
  and return **both languages** for every field.
- Reused as-is: `frontend/lib/localized.ts`'s `pickLocalized` (Story 29),
  `frontend/lib/kb.ts` (Story 29), `frontend/components/ArticleBody.tsx` (Story 30), the
  `KbCategories` i18n section (Story 29), `frontend/lib/locale.ts` (`LOCALE_COOKIE`, `localeDir`).
- `frontend/components/ui/accordion` is **not installed** — this story adds it
  (`npx shadcn@latest add accordion` from `frontend/`). Everything else it needs (`card`, `badge`,
  `button`, `separator`, `tabs`) already is.
- `frontend/app/robots.ts` and `frontend/app/sitemap.ts` **do not exist**. See Open questions.

---

## Design decision 1 — public, not behind customer auth

**These pages and endpoints are public. No login required.** This is the decision the brief asked
to be worked out and justified rather than silently picked, so here is the full reasoning, both
sides.

**The case for public (chosen):**

1. **`CLAUDE.md` already assumes it.** Its SEO section enumerates "**Public, customer-facing
   pages** (home, login, register, and later any public marketing/**knowledge-base** page)" as the
   category needing real SEO. The conventions doc anticipated a public knowledge base by name. That
   is the decisive textual basis; nothing else in the repo contradicts it.
2. **The intake for Story 29 says so.** "FAQ reads (published only) should be public or at least not
   customer-role-restricted, since any visitor should be able to browse FAQs per the feature's
   purpose."
3. **It is the whole point of the feature.** The knowledge base exists to deflect tickets. A visitor
   who has to create an account and log in before they can read "how do I reset my password?" is
   precisely the person who instead opens a ticket — or a live chat, which costs an agent. Gating
   self-service behind the account flow inverts the feature.
4. **The confidentiality boundary is `status: "published"`, not authentication.** An admin has
   already made a per-document decision that this text is shown to customers; there is no second,
   finer audience distinction in the model, and inventing one (published-but-only-for-logged-in)
   would be a new concept with no requirement behind it.
5. **Story 38's own wording is "accessible directly from the portal home screen"** — accessible
   *from* the portal, not *only within* it. A public `/help` linked from `/support` satisfies that
   criterion exactly, and additionally works for someone who hasn't signed up yet.

**The case against (and why it loses):**

- *"Every other customer-portal page is an authenticated shell — `/support`, `/tickets`,
  `/chat` — so this breaks the pattern."* True, and it is the strongest counter-argument. But those
  pages are all **per-customer data** (your tickets, your chats): they are authenticated because
  their content is *about you*. The knowledge base is the same text for everyone, which is exactly
  the property that makes public correct. The pattern being followed is "authenticate when the
  content is personal", not "authenticate because it's under the portal".
- *"Public reads are the first unauthenticated data endpoints in the app, with no rate limiting."*
  Real, and flagged in Story 29's Edge Cases and Open questions. The exposure is low — published,
  deliberately-public text; a bounded enum plus pagination for a query surface, with nothing
  free-text and therefore nothing regex-injectable. It is a reason to add a limiter, not a reason to
  gate content behind login.

**Consequences of choosing public, all of which this plan must honour:**

- **These pages get real SEO**, not `robots: { index: false }` — see Task 3. Distinct `title` and
  `description` per page, exactly one `<h1>`, meaningful heading hierarchy, descriptive link text,
  `alt` on every image. They are the first pages in this app that genuinely *want* to be crawled.
- **They render correctly for a signed-out visitor.** `SiteHeader` already handles the signed-out
  shape; no page here may assume a session exists, and none may call
  `redirect("/api/session/refresh")`.
- **They also render for a signed-in customer, agent, or admin** — nobody is redirected away.
  `frontend/proxy.ts` needs **no change**: `/help` is not in `PROTECTED_PATHS`, and the existing
  `!hasAccess && hasRefresh` refresh hop is harmless (a visitor with neither cookie skips it
  entirely).

---

## Design decision 2 — two kinds of "language", kept strictly apart

The brief asked for this distinction to be explicit, because it is the single easiest thing to
conflate in this story.

| | **UI chrome language** | **Content language** |
|---|---|---|
| What | Page headings, button labels, category names, the "no results" line, the tab labels | The FAQ's question and answer; the article's title, summary and body |
| Who wrote it | Us, at build time | An admin, at authoring time (Stories 29/30) |
| Where it lives | `frontend/messages/{en,ar}.json` | Inside the MongoDB document, as `{ en, ar }` |
| How it's read | `getTranslations("SectionName")` / `useTranslations` (next-intl) | `pickLocalized(field, locale)` from `frontend/lib/localized.ts` |
| Falls back how | next-intl's own missing-message behaviour (should never trigger — `ar.json` mirrors `en.json`) | To the other language, with `lang`/`dir` set on that element |

**They share exactly one thing: the `LOCALE_COOKIE`.** Both are driven by the viewer's chosen
locale, resolved server-side (`frontend/i18n/request.ts` for chrome; a direct `cookies()` read for
content). There is **no `[locale]` URL segment** in this app (`CLAUDE.md`, i18n section) — the
locale is a cookie, which is why article URLs are language-neutral (Story 30, Design decision 4)
and why a shared link renders in *the recipient's* language, not the sender's.

**Category names are chrome, not content** — they come from `t(\`KbCategories.${slug}\`)`, because
the taxonomy is a fixed code-level list (Story 29, Design decision 3), not admin-authored text.

**The fallback rule.** Publish validation (Stories 29/30) guarantees published content has both
languages, so a fallback should be unreachable on this surface. It is still implemented, because
"unreachable" and "impossible" are different, and a blank page is a much worse failure than a
wrong-language one. When `pickLocalized` returns a `language` that differs from the page locale,
**that element must carry `lang` and `dir` of the language actually rendered** — otherwise Arabic
text inherits `dir="ltr"` from `<html>` and mis-renders. `pickLocalized` returns the resolved
language for exactly this purpose; use it, don't discard it.

---

## Design decision 3 — one browse page covering both content types

`/help` shows **FAQs and help articles together**, not two separate destinations. A customer looking
for an answer does not know or care whether it was filed as a short Q&A or a long guide; making them
pick is asking them to know the answer's format before they've found it. One category filter narrows
both at once — which is precisely what the shared taxonomy (Story 29, Design decision 3) was for.

**Presentation differs by type, because the content does:**

- **FAQs** — an `Accordion` (question as the trigger, answer in the panel). Short content, expanded
  in place, no detail page, no navigation cost. Deep-linkable via `#faq-<id>`.
- **Articles** — `Card`s showing title + summary + last-updated date, linking to
  `/help/<slug>`. Long content that deserves its own URL, its own `<h1>`, and its own metadata.

`/help/<slug>` is therefore the **only** detail page in this story.

---

## Frontend Tasks

### 1 — Accordion primitive

From `frontend/`: `npx shadcn@latest add accordion`. Do not hand-roll one, and do not substitute
`<details>/<summary>` — `CLAUDE.md`'s design-system rule is explicit that shadcn ships this.

### 2 — Data helpers

**New file: `frontend/lib/kbPublic.ts`** — server-side fetch helpers used by the public pages, so
neither page hand-rolls URL assembly:

```ts
// Public knowledge-base reads. No Authorization header — deliberately (see
// the plan's "Design decision 1"): published KB content is public, and
// these must work for a signed-out visitor.
//
// `next: { revalidate: KB_REVALIDATE_SECONDS }` rather than the
// `cache: "no-store"` every AUTHENTICATED page in this app uses: those are
// per-viewer and must never be shared, whereas this response is identical
// for every visitor and is served to crawlers. Freshness is not left to the
// timer — the admin Server Actions (Stories 29/30) revalidatePath("/help")
// and /help/<slug> on every publish, edit, unpublish and delete, so a
// change is live immediately; the window only ever covers a change made
// outside the app (e.g. directly in the database).
export const KB_REVALIDATE_SECONDS = 300;
```

- `fetchPublicFaqs({ category, page, limit })` → `{ faqs, total, page, limit }`
- `fetchPublicArticles({ category, page, limit })` → `{ articles, total, page, limit }`
- `fetchPublicArticle(slug)` → the article, or `null` on a 404
- Shared response types (`PublicFaq`, `PublicArticleListItem`, `PublicArticle`) with
  `LocalizedText` fields — explicit interfaces, no `any`.
- **On a non-OK, non-404 backend response** (backend down, 500): return an **empty result**, don't
  throw. A knowledge base that renders "no articles yet" during a backend blip is a far better
  public-page failure than a Next.js error boundary. Log server-side.

### 3 — `/help` — the browse page

**New file: `frontend/app/help/page.tsx`** (Server Component)

```ts
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("HelpCenter");
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    // NOTE: deliberately NO `robots: { index: false }`. This is a public
    // page and one of the few in this app that should actually be crawled —
    // see CLAUDE.md's SEO section and the plan's "Design decision 1".
  };
}
```

- `searchParams: Promise<{ category?: string; faqPage?: string; articlePage?: string }>`. Validate
  `category` against the `KB_CATEGORY_SLUGS` mirror in `frontend/lib/kb.ts` and **ignore an unknown
  value** rather than 400-ing — a public URL with a typo'd query param should render the unfiltered
  page, not an error.
- Two page params, not one, so paginating the articles list doesn't reset the FAQ list.
- Read the locale **once**: `const locale = ((await cookies()).get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE) as Locale;`
  and thread it to `pickLocalized`. (Chrome comes from `getTranslations` as usual — the two paths
  stay separate.)
- Fetch both lists **in parallel** (`Promise.all`), each with its own page param and `limit: 10`.
- Layout:
  - Exactly **one `<h1>`** — `t("heading")`.
  - A lead paragraph (`t("intro")`), and a link back to `/support` for a signed-in customer
    (`t("backToSupport")`).
  - **Category filter** — a row of `Button variant={active ? "default" : "outline"} size="sm"`
    `<Link>`s: "All" plus one per slug, each an href to `/help?category=<slug>`, dropping both page
    params on change. **Plain links, not a client-side `Select`**: this page must work with no
    JavaScript, be crawlable, and give each category a real, shareable, indexable URL. (This is the
    one place the public page deliberately diverges from the admin `FilterField`+`Select` filter-bar
    pattern, and the reason should be in a code comment.) Mark the active one with
    `aria-current="page"`.
  - **`<h2>` FAQs** → `<KbFaqAccordion faqs={...} locale={locale} />` (Task 5), then
    `<ListPagination …>` with `hrefForPage` preserving `category` and `articlePage` while setting
    `faqPage`.
  - **`<h2>` Help articles** → a responsive `grid gap-4 sm:grid-cols-2` of article `Card`s (Task 6),
    then `<ListPagination …>` setting `articlePage`.
  - When **both** lists are empty: one friendly empty state (`t("emptyAll")`) plus a link to
    `/support`. When only one is empty, show that section's own short empty line and keep the other
    section — don't hide a heading, or the page structure jumps between categories.
- Heading hierarchy is `h1` → `h2` (section) → `h3` (accordion trigger / card title). No level
  skipped — this is an SEO/a11y requirement of a public page, not a preference.

### 4 — `/help/[slug]` — the article detail page

**New file: `frontend/app/help/[slug]/page.tsx`** (Server Component)

```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const article = await fetchPublicArticle((await params).slug);
  if (!article) {
    const t = await getTranslations("HelpArticlePage");
    return { title: t("meta.notFoundTitle") };
  }
  const locale = /* LOCALE_COOKIE */;
  return {
    title: pickLocalized(article.title, locale).value,
    description: pickLocalized(article.summary, locale).value,
  };
}
```

- Data-dependent metadata via `generateMetadata()` — exactly the case `CLAUDE.md`'s SEO section
  names ("pages whose title/description depends on fetched data (e.g. a future ticket/KB-article
  detail page)").
- `fetchPublicArticle(slug)` returning `null` → `notFound()` (the app already has
  `frontend/app/not-found.tsx`). A draft, a soft-deleted article, and an unknown slug are
  indistinguishable — the backend already guarantees that (Story 30).
- Render:
  - A breadcrumb-ish back link to `/help` (and to `/help?category=<slug>` for the article's
    category) — **descriptive link text** (`t("backToCategory", { category })`), never "click here".
  - Exactly one `<h1>`: `pickLocalized(article.title, locale)`, with `lang`/`dir` set from the
    resolved language.
  - A meta line: the category badge and **`t("lastUpdated", { date })`** — the acceptance
    criterion's last-updated date, from `updatedAt`, formatted with the viewer's locale.
  - The summary as a lead paragraph.
  - `<ArticleBody markdown={pickLocalized(article.body, locale).value} lang={resolvedLanguage} />`
    — the **same** component the admin preview uses (Story 30), so preview and public render can't
    drift. Its `h2`/`h3` overrides sit correctly under this page's single `h1`.
  - A footer CTA linking to `/support` (`t("stillNeedHelp")`) — the deflection loop closing
    honestly: self-serve first, a human if it didn't help.
- **No** `robots: { index: false }`.

### 5 — `KbFaqAccordion`

**New file: `frontend/app/help/KbFaqAccordion.tsx`** (Client Component — the accordion needs
interactivity)

- Props: `{ faqs: PublicFaq[]; locale: Locale }` — **plain serializable data only**, resolved
  server-side and passed down. Same rule `HeaderSearch` documents: no icon components or
  non-primitives across the boundary, and no token ever reaches a Client Component.
- `Accordion type="single" collapsible`, one `AccordionItem` per FAQ with `id={\`faq-${faq.id}\`}`
  so `#faq-<id>` is a working deep link.
- Trigger: the question, rendered as an `<h3>` inside the trigger, `lang`/`dir` from
  `pickLocalized`'s resolved language.
- Content: the answer as **plain text with preserved line breaks** (`whitespace-pre-line`) — FAQ
  answers are plain text, not Markdown (Story 29 stores them that way). **Do not** run them through
  `ArticleBody`; that would silently create a second content format with different escaping rules.
- Theme tokens only.

### 6 — Article cards

Inline in `page.tsx` (a Server Component — no interactivity needed, so no separate Client
Component): `Card` per article with the title as `<h3>` inside a `<Link href={\`/help/${slug}\`}>`
wrapping the whole card, the summary as `CardDescription` (line-clamped), and a footer row with the
category badge and the last-updated date. The link text is the article title — descriptive by
construction.

### 7 — Reachability: link `/help` from the portal and the header

`CLAUDE.md`: don't build a page only reachable via another page's ad hoc links.

- **`frontend/app/support/page.tsx`** — add a **third `Card`** ("Browse help articles" /
  `BookOpen` icon) alongside Live chat and Submit a ticket, linking to `/help`. This is Story 38's
  "accessible directly from the portal home screen" criterion, satisfied literally. Adjust the grid
  to `sm:grid-cols-2 lg:grid-cols-3`.
- **`frontend/components/SiteHeader.tsx`** — add a **Help** link visible to **everyone**: signed
  out, signed in as a customer, and signed in as staff. Match whatever the header's existing link
  treatment is; keep it a link, **not** a `UserMenu` item (the menu is for account-scoped actions,
  and this must be reachable while signed out, when there is no menu). Verify it doesn't crowd the
  mobile header — if it does, keep it in the desktop header and rely on `/support` for the
  mobile customer path, and say so in a comment.
- **`frontend/lib/customerSearch.ts`** — add `{ key: "helpCenter", href: "/help", icon: BookOpen }`
  to `CUSTOMER_SEARCH_ITEMS`, so a signed-in customer can ⌘K to it. This is a **customer-facing
  destination**, which is a different thing from the KB **admin actions** that Stories 29/30
  deliberately keep out of `STAFF_ACTION_ITEMS` — that exclusion is about admin authoring actions,
  and does not apply here. Say so in a comment so the two decisions don't get conflated.
  Add `Nav.helpCenter` to both message files.
- **`frontend/lib/staffNav.ts`** — **no** change. Staff reach the KB through the admin pages; a
  second public entry in the staff rail is noise. (Staff can still use the header link.)

### 8 — i18n

**Both `frontend/messages/en.json` and `ar.json`, in the same change.** New sections:

- `HelpCenter` — `meta.title`, `meta.description`, `heading`, `intro`, `backToSupport`,
  `filterAll`, `filterLabel`, `faqsHeading`, `articlesHeading`, `faqsEmpty`, `articlesEmpty`,
  `emptyAll`, `lastUpdated` (`"Last updated {date}"`), `readArticle`.
- `HelpArticlePage` — `meta.notFoundTitle`, `backToHelpCenter`, `backToCategory`, `lastUpdated`,
  `stillNeedHelp`, `contactSupport`.
- `Support` addition — `knowledgeBase.title`, `knowledgeBase.description`, `knowledgeBase.cta`.
- `Nav` addition — `help` (header link), `helpCenter` (⌘K entry).
- `KbCategories` — **already exists** (Story 29). Reuse; do not duplicate.
- `Pagination` — already exists (`showing`, `previous`, `next`), used by `ListPagination`.

The `meta.description` strings are real SEO copy on a public page — write them as such in both
languages (one clear sentence describing what a reader will find), not as placeholders.

---

## Deliberate exclusions (restated, because this is the customer-facing surface)

- **No keyword search box anywhere on `/help`.** `USER_STORIES.md` Story 31 owns ranked bilingual
  search with no-result logging. A stopgap would be replaced wholesale by it. See Open questions if
  you'd rather have something now.
- **No "suggest articles while submitting a ticket."** Story 38 proper (see the top of this file).
- **No notifications, and no KB admin actions in any search surface** — Stories 29/30's exclusions
  stand unchanged. Note the one distinction this story does add: `/help` **is** added to
  `CUSTOMER_SEARCH_ITEMS` as a customer destination; that is not an admin action and does not
  weaken the exclusion.
- **No per-customer state**: no bookmarks, no "was this helpful?", no view counts. All would need
  auth (contradicting Design decision 1) or anonymous write endpoints (a new abuse surface), and
  none is in any acceptance criterion.
- **No `robots.ts` / `sitemap.ts`** — `CLAUDE.md` puts site-wide files in platform-feature scope,
  not per-story. See Open questions; this is the first story that makes them genuinely worth adding.

---

## Edge Cases & Failure Modes

- **Signed-out visitor** — the whole surface works; `SiteHeader` shows Log in / Sign up. **This is
  the primary case to test**, and the one most likely to break by copying an authenticated page's
  session boilerplate. No `redirect("/api/session/refresh")` may appear in either page.
- **Signed-in agent/admin visiting `/help`** — sees the same public page; nothing redirects them.
- **A visitor with an expired access cookie but a valid refresh cookie** — `frontend/proxy.ts`'s
  existing `!hasAccess && hasRefresh` branch bounces through `/api/session/refresh` first. Harmless
  (it returns to `/help`), but confirm the round-trip doesn't drop the `category` query param.
- **Unknown `?category=` value** → ignored, unfiltered page rendered. Not a 400, not a
  `notFound()` — a public URL with a typo should still be a page.
- **`?faqPage=999`** → backend returns an empty page; render the section's empty line, and
  `ListPagination` (which returns `null` when `total === 0`) handles the rest. No crash.
- **Empty knowledge base** (nothing published yet) → the `emptyAll` state, not a blank page. Likely
  on first deploy; make it look intentional.
- **Backend unreachable** → `fetchPublic*` returns empty, page renders the empty state, error
  logged server-side. Never an error boundary on a public page.
- **Published content missing one language** — shouldn't be reachable (publish validation), but if
  it is, `pickLocalized` falls back and the element carries the other language's `lang`/`dir`.
  Never render a blank where content should be.
- **RTL** — with the locale cookie set to `ar`, `RootLayout` already sets `dir="rtl"`; the whole
  page mirrors, the accordion chevrons flip, and `ListPagination`'s previous/next flip. Verify the
  category filter row wraps sensibly in both directions.
- **An article whose Markdown contains raw HTML** — inert, by Story 30's `ArticleBody` (no
  `rehype-raw`). **Re-verify on this page specifically**, since this is the one that a stranger on
  the internet can load.
- **Long unbroken strings / wide tables in an article body** — `ArticleBody` wraps tables in
  `overflow-x-auto`; confirm the page body itself never scrolls horizontally on a narrow phone.
- **Stale cache after a publish** — the admin Server Actions (Stories 29/30) call
  `revalidatePath("/help")` and `revalidatePath("/help/<slug>")`, so a publish is live immediately;
  `KB_REVALIDATE_SECONDS` only bounds changes made outside the app. If a publish *doesn't* show up,
  that revalidate call is the first thing to check.
- **Unauthenticated traffic volume** — see Story 29's Edge Cases and Open questions; no rate
  limiting exists in this codebase to inherit. The `revalidate` cache does absorb most repeat load.

---

## Test Plan

**Backend:** no new endpoints, so no new backend tests. The public-endpoint tests written in
Stories 29 and 30 (`backend/tests/routes/kbPublic.routes.test.ts`) already cover the contract this
story consumes — in particular "no `Authorization` header → 200" and "a draft's slug → 404,
identical to an unknown slug". **Re-run them; do not weaken them.**

**Frontend:** no test runner exists (`CLAUDE.md`, "Testing"). Manual verification, in this order —
the first item is the one that actually distinguishes this story:

1. **Fully signed out** (clear all cookies, or use a private window): `/help` renders both sections,
   the category filter navigates and marks the active category, both paginations work
   independently, and `/help/<slug>` renders a full article. **No redirect to `/`, `/login`, or
   `/api/session/refresh` at any point.**
2. Signed in as a **customer**: `/support` shows the third "Browse help articles" card and it
   navigates to `/help`; ⌘K offers the help-centre entry.
3. Signed in as an **agent/admin**: `/help` renders normally; the staff rail is unchanged.
4. **Language:** set the locale to Arabic via the user menu — the chrome translates, the layout
   mirrors RTL, and FAQ/article **content** switches to its Arabic fields. Switch back and confirm
   the English content returns. Then, using a draft-era article that has only English (temporarily
   flip it published in the database if needed), confirm the fallback renders the English inside the
   Arabic page **with `lang="en" dir="ltr"` on that block** — inspect the DOM, don't eyeball it.
5. **SEO:** view source on `/help` and `/help/<slug>` — a distinct `<title>` and
   `<meta name="description">` per page, **exactly one `<h1>`**, no skipped heading levels, no
   `noindex` meta, every `<img>` in an article body has an `alt`, and every link has descriptive
   text.
6. **Security:** load an article whose body contains `<script>alert(1)</script>`,
   `<img src=x onerror=alert(1)>` and `[x](javascript:alert(1))` — the first two appear as inert
   visible text, the third's URL is stripped, **nothing executes**, on the public page while signed
   out.
7. **Freshness:** unpublish a published article in the admin UI → its `/help/<slug>` 404s and it
   disappears from `/help` **without waiting** for the revalidate window (proves the
   `revalidatePath` calls). Republish → it comes back.
8. **Empty and error states:** with nothing published, `/help` shows `emptyAll`. With the backend
   stopped, `/help` still renders (empty), rather than an error page.
9. **Responsive:** at 360px width, the category row wraps, article cards stack, the accordion is
   usable, and the page never scrolls horizontally — in both LTR and RTL.
10. `cd frontend && npm run build` → no type errors.
11. **Regression:** `/support`, `/tickets`, `/chat`, `/dashboard` and the admin KB pages all
    unchanged; the header's new Help link doesn't break the mobile layout.

---

## Migration / Rollback

- **Purely additive and frontend-only** (plus one shadcn primitive). No schema change, no new
  endpoint, no permission key, no backend file touched.
- **Rollback:** delete `frontend/app/help/`, `frontend/lib/kbPublic.ts`, and
  `frontend/components/ui/accordion.tsx`; revert the additions to `app/support/page.tsx`,
  `components/SiteHeader.tsx`, `lib/customerSearch.ts`, and both message files. Stories 29 and 30
  keep working untouched — their public endpoints simply have no consumer again, which is exactly
  the state this story exists to fix.

---

## Done Criteria

- [ ] `/help` and `/help/[slug]` render **fully for a signed-out visitor**, with no auth check, no
      session redirect, and no `robots: { index: false }`.
- [ ] Only `status: "published"`, non-deleted content is reachable — a draft's slug 404s exactly
      like an unknown one (backend-guaranteed; verified from the public page).
- [ ] One page covers **both** FAQs (accordion, deep-linkable) and help articles (cards →
      `/help/<slug>`), with a **shared category filter** built from plain crawlable links.
- [ ] Content renders in the viewer's cookie-selected language via `pickLocalized`, with a
      fallback that sets `lang`/`dir` on the element — and this is kept **strictly separate** from
      next-intl chrome translation, with category names coming from the chrome side.
- [ ] Article bodies render through the **same** `frontend/components/ArticleBody.tsx` the admin
      preview uses; raw HTML in a body is inert on the public page.
- [ ] Real SEO on both pages: distinct i18n'd `title`/`description` (via `generateMetadata` on the
      detail page), one `<h1>`, no skipped heading levels, descriptive link text, `alt` on images.
- [ ] `/help` is reachable from `/support`, from the site header (signed out **and** in), and from
      customer ⌘K — not only via ad hoc links.
- [ ] `ListPagination` drives both lists independently via separate URL params; the category filter
      resets both.
- [ ] Every new string is in **both** `en.json` and `ar.json`; `KbCategories` is reused, not
      duplicated; no hardcoded English; no hardcoded hex.
- [ ] Publishing/unpublishing in the admin UI is reflected on `/help` immediately (the
      `revalidatePath` calls from Stories 29/30 work).
- [ ] **Nothing** from `USER_STORIES.md` Story 31 (ranked KB search) or the Story 38
      ticket-submission cross-link is built, and both exclusions are recorded here and in code
      comments where a reviewer would look.
- [ ] `npm run build` (frontend) passes clean; backend tests still pass unchanged.

**STOP HERE. Report to the user. The `knowledge-base` feature is then complete except for
`USER_STORIES.md` Story 31 (Search the knowledge base), which remains unplanned.**

---

## Open questions for the user

1. **`robots.ts` / `sitemap.ts`.** `/help` and `/help/[slug]` are the **first pages in this app that
   genuinely want crawling**, and `CLAUDE.md` says the site-wide files should be added "once, when
   the first public page that should actually be crawled exists" — while also calling them
   platform-feature scope, not per-story. Those two sentences now point in opposite directions.
   Options: (a) add both files here (a `sitemap.ts` listing `/`, `/login`, `/register`, `/help`, and
   every published article slug — the last needs a fetch, which is fine in a `sitemap.ts`);
   (b) leave both to the platform story and accept that the KB is uncrawled until then. **Your
   call.** (a) is cheap and is what makes the public decision actually pay off.
2. **A stopgap search box on `/help`.** This plan ships browse + category filter only, because
   `USER_STORIES.md` Story 31 owns real ranked bilingual search with no-result logging. If waiting
   is unacceptable, the cheapest honest interim is a **client-side filter over the current page's
   already-loaded items** (no backend change, no ranking, obviously scoped to what's on screen) —
   but it would be thrown away by Story 31. **Ship browse-only, or add the interim filter?**
3. **How much of the FAQ list to show at once.** This plan paginates FAQs at 10 per page like every
   other list in the app. For a knowledge base, showing **all** FAQs in a category on one page
   (accordion, collapsed) is often better — nothing to click through, and Ctrl-F works. That would
   mean dropping `ListPagination` for the FAQ section specifically, which diverges from the
   list-view convention. **Keep pagination, or show all FAQs per category?**
4. **Does the Help link belong in the signed-out site header?** This plan puts it there so a visitor
   who has never signed up can find the knowledge base, which is the main argument for making it
   public at all. If you'd rather the marketing landing page own that entry point instead (a
   section link rather than a header link), say so — it's a one-line change either way.
