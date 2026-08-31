# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ticket-management/status-quick-filter-chips-on-the-ticket-queue/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `n/a` *(not a numbered story in USER_STORIES.md — a small UI enhancement to Story 60's already-built queue, agreed in chat on 2026-08-31)*
- **Work item type:** `Enhancement`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ticket-management`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Status quick-filter chips on the ticket queue
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an agent or admin, I want to see how many tickets are in each status at a
glance and jump straight to one status, so that triaging the queue doesn't
require opening the status filter dropdown and re-scanning the table every
time.

Context: this came out of a chat discussion (2026-08-31) about whether the
staff ticket queue (Story 60, already built — StaffTicketQueue.tsx) should
become a Kanban/pipeline board instead, one column per status, like a sales
CRM pipeline view. Decided against a board: ticket status mostly changes as
a side effect of another action (replying auto-sets "answered" per Story 56,
an SLA breach can auto-escalate per Story 28), not a deliberate drag/reorder
the way a sales rep repositions a deal card — so a board's main affordance
(dragging) wouldn't be the primary interaction, and it would fight the
priority/SLA-driven triage the table's sort/filter already does well. This
story is the lighter-weight version of the same idea: status counts visible
at a glance, one click to filter, no drag-and-drop, no new page.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Above the existing filter bar/table in the staff branch of /tickets, show
  one row of pill-shaped chips: "All <total>", then one chip per status
  (New, In Progress, Answered, Escalated, Closed), each with its own live
  count, scoped the same way the table already is (an agent viewer without
  tickets:view_all sees counts for their own assigned tickets only; an
  account with tickets:view_all, or admin/subadmin, sees counts across every
  ticket).
- Clicking a chip filters the table to that status (same as picking that
  value from the existing status filter dropdown in TicketFilterBar.tsx) and
  visually marks itself as the active chip; "All" clears the status filter.
  The existing status dropdown keeps working exactly as it does today — the
  chips are a faster shortcut to the same query param, not a replacement.
- Chips reflect the same category/priority filters currently applied (i.e.
  counts are computed against the filtered set, not the whole unfiltered
  queue) — so switching category/priority and then reading the chip counts
  gives an accurate breakdown of what's currently filterable by status.
- Pagination resets to page 1 when a chip changes the status filter, same
  behavior as changing any other filter today.
- Customer branch of /tickets is unaffected — no chips, matches Story 60's
  existing decision that the customer list skips filter/sort UI entirely.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
None.

---

## Dependencies

- **Blocked by / related ids:** Story 60 (`view-and-filter-the-ticket-queue`, already built) — this story only adds to that already-shipped page/component, it doesn't rebuild it. Story 11 (`update-ticket-status`) adds the `escalated`/status-transition logic this chip row displays counts for, but isn't required to land first — the status field and its five values already exist on `Ticket.ts` today.
- **Depends on code areas or other stories:** `frontend/app/tickets/TicketFilterBar.tsx` (existing status filter dropdown — chips are additive, sit above/beside it, don't replace it), `frontend/app/tickets/StaffTicketQueue.tsx` (renders the filter bar today), `frontend/app/tickets/page.tsx` (owns the `status`/`category`/`priority`/`page` query-param handling and the `GET /api/v1/tickets` call), `backend/src/routes/ticket.routes.ts`'s `GET /` handler (the existing list endpoint — needs a way to return per-status counts alongside the page of results, scoped the same way the list itself already is: forced `customer`/`assignedAgent` filter unless the caller holds `tickets:view_all`).

## Extra notes (optional)

- Came out of a UI-design discussion in chat, not from a numbered backlog item — see Description's context paragraph for the full reasoning against a Kanban/pipeline-board alternative.
- Reference visual for the chip shape/style (pill, count badge inside, one active/selected state): a CRM pipeline-filter row screenshot the user shared showing "All 10 / champion 2 / decision-maker 1 / ..." pills — same shape, but here scoped to the 5 ticket statuses instead of arbitrary tags, and clicking one filters instead of that product's own semantics.
- Counts need a backend source: either (a) one extra endpoint/param that returns `{ status: count }` grouped by the same scope+filters as the list query (likely a single aggregation query alongside the existing `find`), or (b) piggyback the counts onto the existing `GET /` response as a sibling field (e.g. `statusCounts`) so the frontend doesn't need a second request on every page load. State which was chosen and why, rather than picking silently — a second endpoint means an extra round-trip on every filter change; piggybacking couples the list and count queries but avoids that.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Chip styling should reuse the same semantic status-color tokens already used for the status `Badge` in `StaffTicketQueue.tsx` (`STATUS_BADGE_CLASS`) rather than inventing new colors, per CLAUDE.md's design-system rule ("Use these three [success/warning/destructive] for any SLA/ticket-status indicator so status color stays consistent").
- i18n: chip labels reuse the existing `STATUS_KEY`/`Tickets` translation keys already in `en.json`/`ar.json` (`statusNew`, `statusInProgress`, etc.) — no new keys needed for the labels themselves, only for the "All" chip and its count if not already covered by `t("all")` or similar existing key.

## Out of scope

- Any Kanban/drag-and-drop board view — explicitly rejected in the chat discussion this story came from (see Description).
- Live/real-time count updates via Socket.io as tickets change status elsewhere — a page load or filter-change refetch is enough for this pass, same reasoning Story 60 already applied to its own "real-time push" out-of-scope note.
- Chips for category or priority — status only, for now.
