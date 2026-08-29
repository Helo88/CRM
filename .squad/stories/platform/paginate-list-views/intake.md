# Story intake

- Folder: `.squad/stories/platform/paginate-list-views/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Platform
- **Feature slug (folder under `plans/`):** `platform`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `59` *(Story 59 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `platform`

---

## Title

```
Paginate list views
```

---

## Description

```
As a user of any list screen in the app, I want to page through results
instead of everything loading at once, so that large lists — tickets
first, others later — stay fast to load and easy to scan.
```

---

## Acceptance criteria

```
- One reusable pagination component (page controls plus a result-count
  readout) that any list screen can drop in, instead of each feature
  building its own.
- List endpoints accept page/limit query params and return that page of
  results plus a total count alongside them — pagination happens
  server-side, never by fetching everything and slicing it in the
  browser.
- First real integration is `ticket-management` Story 60's ticket queue;
  built generically enough that later list views (customer roster, KB
  articles, reports) can adopt the same component and query-param
  contract without rework.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| `attachments/agent-list-pagination.png` | Where the pagination control sits relative to the ticket queue table, from the approved "Ticket Views" mockup (the mockup itself doesn't render live pagination controls — use it for table layout/footer placement context only). |

*(Skipped — the mockup doesn't render a live pagination control, so there was nothing distinct to capture beyond the table layout already covered by Story 60's own screenshots.)*

---

## Dependencies

> **STATUS (2026-08-30): subsumed into `ticket-management`'s Story 60 intake** (`.squad/stories/ticket-management/view-and-filter-the-ticket-queue/intake.md`), built in the same pass as that story — see that intake's "MERGED SCOPE" note. The reasoning below (build the reusable primitive before/alongside its first consumer) still holds, but the original "do not build it [Story 60] yet" advice is superseded: Story 60 no longer waits on this being planned separately. Don't plan/build this intake on its own; it's kept here as the original acceptance-criteria source, not as a standalone target.

- **Blocked by / related ids:** None — this is a foundational, reusable piece. `ticket-management` Story 60 (view and filter the ticket queue) is its first and only required consumer for this pass; do not build it, since it comes later in the plan sequence and this story should be usable standalone first.
- **Depends on code areas or other stories:** No existing list endpoint in the codebase currently supports pagination — `backend/src/routes/ticket.routes.ts`'s `GET /` is a `501` stub with no query-param handling yet. No shared list/table component exists in `frontend/components/ui/` (shadcn's `table` primitive is installed, but there's no pagination control built on top of it yet).

## Extra notes (optional)

- Existing precedent for "build the generic, reusable primitive before its first real feature needs it, so nothing has to be reworked" is Story 50 (bilingual UI, i18n layer built early) and Story 51 (mobile-responsive) — this story follows the same reasoning, pulled forward out of the `platform` feature the same way those were.
- Pick ONE pagination style (page-number-based `?page=2&limit=20` returning `{ items, total, page, limit }`, or cursor-based `?cursor=...&limit=20` returning `{ items, nextCursor }`) and state the choice in the plan — page-number is simpler and fine for this app's expected data volumes (a single support team's ticket queue, not a firehose), cursor-based is more resilient to concurrent inserts shifting pages but adds complexity most list views here don't need yet.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Frontend: a new component under `frontend/components/ui/` (or alongside it, following the shadcn-installed-primitives convention in CLAUDE.md) — e.g. `pagination.tsx`, built from primitives already installed (`button`) rather than reaching for a new dependency; check `npm view` per CLAUDE.md's dependency-freshness policy only if a new package is actually needed (it shouldn't be, for a page-number control).
- Backend: a small shared helper (e.g. `backend/src/utils/pagination.ts`) that parses/validates `page`/`limit` query params (with sane defaults and a max `limit` cap) and shapes the Mongoose `.skip()/.limit()` + `.countDocuments()` call, so `ticket.routes.ts` and future list routes call one function instead of each hand-rolling the same logic.

## Out of scope

- Retrofitting pagination onto any *other* existing list endpoint (customer roster, etc.) — this pass only wires it into the ticket queue (Story 60); the customer roster and other lists can adopt it later without needing this story reopened, since the contract is designed to be reusable.
