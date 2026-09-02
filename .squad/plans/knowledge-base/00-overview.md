# knowledge-base — plan overview

Entry point for the **knowledge-base** feature. Stories execute in order by their `NN` prefix.

> **Hand-authored, not squad-kit generated.** At the user's direction ("just UI and forms, mainly
> effort in UI") this feature's plans were written by hand rather than through `squad new-plan`.
> Two of the three still have intake files under `.squad/stories/knowledge-base/` and those remain
> the requirements source; the third has none (see below). Do not re-run the generator over this
> folder — it would overwrite these files.
>
> **`NN` here mirrors the `USER_STORIES.md` story number, not the global squad-kit sequence** used
> by the other feature folders (`.squad/plans/00-index.md`). Story 31's file is the one exception —
> see its note.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 29 | `29-story-manage-faqs.md` | Manage FAQs | 29 | — |
| 30 | `30-story-write-and-organize-help-articles.md` | Write and organize help articles | 30 | 29 |
| 31 | `31-story-knowledge-base-customer-browsing.md` | Knowledge-base customer browsing | 38 *(partial, pulled forward)* | 29, 30 |
| — | _not planned_ | Search the knowledge base | 31 | 29, 30 |

## Dependency notes

- **Story 29 is the foundation and must be built first.** It introduces four things every later
  story in this folder reuses rather than re-deriving: the **bilingual content shape**
  (`backend/src/models/localizedText.ts`'s `ILocalizedText`, keyed by the existing
  `Language = "en" | "ar"` from `models/User.ts` — the first bilingual *content* model in the
  codebase); the shared **KB vocabulary** (`backend/src/constants/kb.ts` — one fixed category slug
  list and the `draft`/`published` enum, shared by FAQs and articles so the customer browse page can
  filter both with one control); the **draft/published + `publishedAt` + `isDeleted` soft-delete**
  pattern; and the **public read router** (`backend/src/routes/kbPublic.routes.ts`), which is kept
  separate from the admin routers on purpose so the "never leak a draft" invariant lives in one
  small unauthenticated file. Story 30 clones all of it; Story 31 consumes it.
- **Story 30 is a near-clone of Story 29** with three genuine additions: Markdown bodies (rendered
  by `react-markdown` + `remark-gfm`, **never `rehype-raw`** — the one new dependency in this
  feature, and the one security property the design rests on), a language-neutral unique **slug**
  for the public article URL, and a third bilingual field (`summary`) that doubles as the public
  page's SEO meta description. If anything in the shared Story 29 code looks wrong while building
  Story 30, **fix it in place and re-verify Story 29** — do not fork a parallel version.
- **Permission keys: per-entity for CRUD, one shared key for publish.** Story 29 adds
  `kb:faq_view_list` / `kb:faq_create` / `kb:faq_edit` / `kb:faq_delete`; Story 30 adds the
  `kb:article_*` equivalents; **both reuse the `kb:publish` key already reserved in
  `backend/src/constants/permissions.ts`** rather than introducing `kb:faq_publish` /
  `kb:article_publish`. Curating short Q&A pairs and writing long-form guides are separately
  delegable jobs, so their CRUD keys are separate; publishing is one editorial authority ("this is
  now customer-visible, in both languages") regardless of collection, and that key is already
  wired into `SUBADMIN_ONLY_PERMISSIONS`, `frontend/lib/permissions.ts` and the i18n labels. All
  eight new keys are sub-admin-only; `DEFAULT_PERMISSIONS_BY_ROLE` is untouched. Two enforcement
  rules must not be softened in either story: **`POST` never accepts a `status` field** (so
  `kb:*_create` can't back-door around `kb:publish`), and **`PATCH` checks keys per changed field
  inside the handler** (the `ticketCategory.routes.ts` precedent), with both checks running before
  any mutation.
- **Publishing requires both languages; drafts don't.** The rule is enforced once, in the
  service-layer choke point, because it depends on `status` and so cannot live in the Mongoose
  schema or the zod body schema. This is what makes the AI draft-translate assist useful rather than
  decorative: write one language → save a draft → generate and edit the other → publish.
- **Story 31 is a deliberate, out-of-order scope decision by the user, not an oversight.** It pulls
  the *browse* half of `customer-portal` **Story 38 ("Browse FAQs from the portal")** forward, ahead
  of the recommended build order, because Stories 29 and 30 otherwise ship a complete admin
  authoring surface for content no customer can see — the exact failure `CLAUDE.md`'s
  "ship the frontend in the same story" convention exists to prevent. It has **no intake file** and
  its `NN` does not correspond to `USER_STORIES.md` Story 31. It covers two of Story 38's three
  acceptance criteria; the third (**"portal suggests relevant articles before the customer finishes
  submitting a new ticket"**) is explicitly left for Story 38 proper or a follow-up, since it hangs
  off the ticket-submission flow and needs a relevance mechanism that doesn't exist yet. **When
  Story 38 is planned under `customer-portal`, its plan must open by recording what is already
  built here.**
- **Story 31 makes the KB public (no login).** Justified in that plan's "Design decision 1" — the
  decisive basis is that `CLAUDE.md`'s SEO section already enumerates "any public
  marketing/**knowledge-base** page" as needing real SEO, plus Story 29's intake, plus the
  deflection logic (a visitor forced to sign up before reading an answer opens a ticket instead).
  The confidentiality boundary is `status: "published"`, not authentication. Consequences: those two
  pages get **real SEO** rather than `robots: { index: false }`, and `GET /api/v1/kb/public/*` are
  the **first unauthenticated data endpoints in this codebase** — there is no rate limiting anywhere
  to inherit, which is flagged as an open question in both Stories 29 and 31 rather than solved.
- **`USER_STORIES.md` Story 31, "Search the knowledge base", is deliberately not planned here** and
  remains the feature's one unbuilt story. Ranked bilingual results across FAQs *and* articles, with
  no-result logging so content gaps surface, is a real piece of work that neither the admin lists'
  `?q=` substring filter (a standard list-view filter, present in Stories 29/30) nor Story 31's
  category browse pretends to be. Do not grow either into it.
- **Two conventions are deliberately NOT followed in this feature, at the user's explicit
  direction** — both are recorded in every plan file so a reviewer doesn't "fix" them:
  (1) **No in-app notifications** fire for any KB admin action (add/edit/delete/publish). The bell
  exists to tell a specific person something needs their attention; nobody is waiting on an
  individual FAQ. (2) **No KB admin action is added to the ⌘K quick-action index**
  (`STAFF_ACTION_ITEMS` in `frontend/lib/staffNav.ts`), and if a real global command palette is ever
  built on the currently-unused `cmdk` primitive at `frontend/components/ui/command.tsx`, KB admin
  actions must stay out of it. What **is** added: two `STAFF_NAV_ITEMS` **destinations** (the FAQ
  and article list pages, each gated on its own `view_list` key — a page with no nav entry violates
  `CLAUDE.md`), two `PAGE_SEARCH_TARGETS` entries (the per-list "search this page" affordance that
  is part of the standard list-view pattern), and, in Story 31, `/help` as a **customer**
  destination in `CUSTOMER_SEARCH_ITEMS`. Destinations and per-list search are different surfaces
  from the action index; that distinction is load-bearing.
- **AI scope is narrow and admin-only.** Two optional, non-blocking Gemini assists in the authoring
  forms — **draft-translate** (fill one language, get an editable machine draft of the other; never
  auto-published) and **duplicate-flag** (a two-stage check that skips Gemini entirely when a cheap
  DB shortlist comes back empty, and returns nothing on any failure). Both sit in
  `backend/src/services/kbAi.service.ts` on top of `gemini.service.ts`'s `generateText`, which
  already returns `null` rather than throwing. Neither ever gates a save, and a Gemini outage is
  **invisible** rather than an error state. **`ai-features` Story 35 ("AI-suggested knowledge-base
  solutions") is explicitly out of scope** here — that one is agent-facing, ranks KB content against
  live ticket/chat conversations, and learns from accept/dismiss feedback. It is also the reason
  `CLAUDE.md`'s build order puts `knowledge-base` before `ai-features`: Story 35 needs real KB
  content to suggest from, which is what this feature produces.
- **A future system-wide audit log is designed *for*, not built.** Stories 29 and 30 both structure
  every mutation as a single choke-point service function (`backend/src/services/faq.service.ts`,
  `helpArticle.service.ts` — `create` / `update` / `softDelete`, each taking `actorId`, with no
  route handler ever writing the model directly), specifically so that hooking a generic audit-log
  call in later is one line per action rather than a refactor. Neither plan creates or stubs an
  `AuditLog` model, and neither designs the entry shape — that is a separate, cross-cutting planning
  exercise the user will run when ready (`audit:view` is already reserved in
  `backend/src/constants/permissions.ts`; `USER_STORIES.md` Story 47 is its backlog home). Both
  plans note the in-repo precedent worth being consistent with — `backend/src/models/Ticket.ts`'s
  append-only `{ <new value>, changedBy, changedAt }` history entries — and both note that
  `createdBy`/`updatedBy` on the KB models are current-state fields, **not** an audit trail.
- **Downstream consumers to keep in mind, but not build for speculatively:** `ai-features` Story 35
  will reference KB documents by id (which is part of why deletes here are soft, not hard), and
  `USER_STORIES.md` Story 31's search will query the same two collections. Keep the resource ids and
  the `/api/v1/kb/...` route boundaries stable, per `CLAUDE.md`'s scope note on integrations.
