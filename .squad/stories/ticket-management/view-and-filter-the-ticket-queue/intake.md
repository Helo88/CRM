# Story intake

- Folder: `.squad/stories/ticket-management/view-and-filter-the-ticket-queue/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `60` *(Story 60 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ticket-management`

---

## Title

```
View and filter the ticket queue
```

---

## Description

```
As an agent or admin, I want to see a filterable, sortable, paginated list
of tickets, so that I can find what I need instead of scrolling through
everything I'm not looking for.

MERGED SCOPE (decided with the user, 2026-08-30): this build also covers
Story 36 ("Track ticket status from the portal") and Story 59 ("Paginate
list views") in the same pass, rather than as three separate builds. All
three converge on the exact same backend stub (GET /api/v1/tickets) and,
for the customer branch, the same ticket-detail page — planning them
separately risked one being implemented without the other noticing.
Story 59 was already noted in USER_STORIES.md's own numbering comment as
"pulled forward... ticket-management Story 60 needs it," so building it
alongside isn't scope creep, it's the backlog's own intended pairing.

As a customer (Story 36), I want to see my own tickets with their current
status, and open one to read the conversation so far, so that I know
what's happening without asking an agent.

As a user of any list screen (Story 59), I want to page through results
instead of everything loading at once, via one reusable pagination
component and a server-side page/limit contract — first applied here,
reused by later list views.
```

---

## Acceptance criteria

```
- An agent's queue defaults to their own assigned tickets; an account
  granted `tickets:view_all` sees every ticket across every agent instead,
  with an added "Assigned to" column. A customer's list is always scoped
  to their own tickets only, regardless of any query params sent.
- Filterable by status, category, and priority, and sortable by any of
  those plus last-updated (staff view only — see Extra notes on why the
  customer view skips filter/sort UI for this pass).
- Each row surfaces reply (Story 56) and escalate (Story 12) actions;
  reassign (`tickets:reassign`) and delete (`tickets:delete`) only appear
  for accounts granted that permission. Customer rows have no actions —
  clicking the row is the only interaction.
- List is paginated server-side (page/limit query params, response
  includes a total count) via one reusable pagination component used by
  both the staff queue and the customer list.
- Every row (staff and customer) is a clickable link to that ticket's
  detail page.
- A customer can open one of their own tickets and see the conversation
  so far (thread), read-only — no category/priority editing, no reply
  composer, no internal notes (those stay staff-only, filtered out of the
  response for a customer caller).
- A customer opening a ticket that isn't theirs gets a 403/redirect, same
  as any other cross-tenant access in this app (mirrors
  `chat.socket.ts`'s `isAuthorizedOnConversation` reasoning) — never a 404
  that would leak whether the ID exists.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| `attachments/agent-list.png` | The agent's ticket queue table — columns, filter/toolbar buttons, per-row reply/escalate icon actions. From the approved "Ticket Views" mockup. |
| `attachments/subadmin-list.png` | The sub-admin/full-queue variant — extra "Assigned to" column, reassign/delete icon actions (delete shown disabled/locked when `tickets:delete` isn't granted), and the permission legend below the table. |

*(Both screenshots are in place under `attachments/`.)*

---

## Dependencies

- **Blocked by / related ids:** none blocking — `platform` Story 59 (shared pagination component) is built AS PART OF this same story now (see merged-scope note above), not a prerequisite to wait on. Story 9 (categorize and prioritize) and Story 58 (manage categories) supply the category/priority values being filtered on (staff view only). Story 56 (reply) and Story 12 (escalate) are the actions surfaced per staff row — those can be stubbed/linked-but-not-yet-functional if planned before this story, but the icon buttons and their destinations belong here. Story 8 (submit a ticket) is what populates the list a customer sees.
- **Depends on code areas or other stories:** `backend/src/routes/ticket.routes.ts` — `GET /` (currently a `501` stub, this story implements it with three branches: customer/agent/admin), `GET /:id` and `GET /:id/messages` (currently `requireRole("agent","admin","subadmin")` only — this story adds a customer-ownership branch to both, verified against real code at `ticket.routes.ts:203-227` and `:339-364`). `backend/src/models/Ticket.ts` (`status`, `category`, `priority`, `assignedAgent`, `customer` — all fields being filtered/sorted/scoped on already exist on the schema). `backend/src/models/Message.ts` (`internal: boolean` — must be filtered out of the customer-facing `GET /:id/messages` response; staff keep seeing it, unchanged). `backend/src/constants/permissions.ts` (`tickets:view_all`, `tickets:reassign`, `tickets:delete` already reserved keys). `frontend/lib/staffNav.ts` (`STAFF_NAV_ITEMS` — add a `tickets` entry, `staffOnly: false`, same visibility pattern as the existing `customers` entry). `frontend/app/tickets/[id]/page.tsx` (currently redirects any non-staff role to `/dashboard` at line ~86 — add a customer-ownership branch instead of only redirecting).

## Extra notes (optional)

- This is the piece of `ticket.routes.ts`'s `GET /` stub referenced by multiple other stories' intakes (Story 9's old intake explicitly called out "'filtered and sorted' is a `GET /` query-parameter concern on the existing ticket list stub" — that concern now formally belongs here, not Story 9).
- The two mockup screenshots (agent vs. sub-admin) are the SAME table component with a permission-driven column/action set, not two separate pages — see the "Frontend" bullet below. Build one table, conditionally rendering the "Assigned to" column and the reassign/delete icon buttons based on the caller's granted permissions (returned from `/auth/me` or wherever the frontend already knows the current user's permission set — check `frontend/lib/` for the existing pattern from `security-admin` work before inventing a new one).
- The mockup's SLA column is a preview only — `sla-automation` Story 27 doesn't exist yet, so this story either omits that column or renders it as a static placeholder; don't build real SLA calculation here.
- **Route structure, decided with the user:** ONE route (`/tickets`) for the list, role-branched inside a single `page.tsx` — customer sees their own list (no `StaffSidebar`, no filter/sort controls, no per-row actions), staff sees the queue (`<StaffSidebar active="tickets" />`, filters, sort, permission-gated actions). Same pattern already used by `/tickets/[id]`. Do not build a second URL (e.g. `/portal/tickets`) for the customer view — mirrors how `/tickets/[id]` and `/customers` already do single-page role branching rather than forking pages per role.
- **Customer list has no filter/sort UI in this pass** — Story 36's own acceptance criteria never asked for it (only status + last-updated + click-through), and a customer's own ticket count is expected to be small enough that pagination alone is sufficient. Add filters later only if asked.
- **Internal-message filtering is the one real security-sensitive edge case here:** `GET /:id/messages`'s customer branch MUST exclude `internal: true` messages (per `Message.ts`'s own doc comment: "internal: true covers agent-only notes... never shown to the customer") — the staff branch is unchanged and keeps seeing everything. Write a test that seeds an internal message and asserts a customer-caller's response excludes it.
- **Ownership check on `GET /:id` and `GET /:id/messages` for a customer caller:** a ticket that exists but belongs to a different customer must respond the same way as one that doesn't exist (404), not 403 — 403 would confirm the ID is valid and leak that *some* ticket exists at that ID, which a customer has no legitimate reason to learn. (This differs from the staff branch, which is unchanged and stays a flat role gate with no per-ticket ownership check.)

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `GET /api/v1/tickets` query params: `status`, `category`, `priority`, `sort` (e.g. `sort=-updatedAt`) — staff branch only; customer branch ignores these and always returns their own tickets sorted by `updatedAt` descending. `page`/`limit` (Story 59's pagination contract) apply to both branches. Scoping: if caller is `customer`, force `customer: req.user.id` into the query; if caller lacks `tickets:view_all`, force `assignedAgent: req.user.id`; an account with `tickets:view_all` gets no forced filter. Never trust a client-supplied scope flag.
- Response shape for a paginated list: `{ tickets: [...], total: number, page: number, limit: number }` (or equivalent) — the reusable pagination component needs `total` to render page controls/result-count, per Story 59's own acceptance criteria ("return that page of results plus a total count alongside them").
- Gate `GET /` with `requireAuth` only at the middleware level (all three roles are allowed in, branching happens inside the handler based on `req.user.role` and `tickets:view_all`) — per `[[feedback_every_route_needs_permission]]`, this is the same "role-gate plus in-handler permission narrowing" shape already used elsewhere in this file (see `customerOrPermitted` at `ticket.routes.ts:41-49`), not a new pattern.
- Gate `GET /:id` and `GET /:id/messages` similarly: `requireAuth` + role check that now includes `"customer"`, with the customer branch adding the ownership check (`ticket.customer.toString() === req.user.id`) and, for `/messages`, filtering `internal: true` out of the response array before sending.
- Frontend: `frontend/app/tickets/page.tsx` (new file — the list, both branches) using the shadcn `table` primitive, matching the columns/badges in the attached screenshots for the staff branch (status/priority/category chips, avatar+name for customer, icon-button actions) and a simpler status+date table for the customer branch. New shared pagination component (Story 59) goes in `frontend/components/ui/` or `frontend/components/` (check `components.json`'s convention before picking a location) so later list views (customer roster, KB articles, reports) can reuse it without rework, per Story 59's own acceptance criteria.
- `frontend/lib/staffNav.ts`: add `{ key: "tickets", href: "/tickets", icon: <pick one not already used, e.g. Ticket from lucide-react>, staffOnly: false }` to `STAFF_NAV_ITEMS`, and a matching `"tickets"` key in `frontend/messages/en.json`/`ar.json`'s `Nav` section (same section `dashboard`/`customers`/`accounts` already live in). A customer needs a way to reach `/tickets` too — check whether `SiteHeader`'s customer-facing UI (currently just "Get support" + the `UserMenu` dropdown) needs a new entry point, or whether linking from `/support` (Story 53's page) is enough for this pass; don't leave it reachable only by typing the URL.

## Out of scope

- The reply composer and escalate flow themselves (Stories 56, 12) — this story only wires up the entry-point buttons/links.
- SLA calculation/display (`sla-automation` Story 27).
- The unified agent+chat dashboard (`agent-workspace` Story 20) — this is the ticket-only queue; Story 20 may later combine this with live-chat's equivalent list.
- Real-time push of status changes to the customer list/detail (Story 36's "or on refresh" wording makes this explicitly non-blocking — a plain `GET`-on-load is acceptable, Socket.io push is a future nice-to-have).
- Full support history with search over closed/resolved items (customer-portal Story 37, separate, immediately-following story — this pass shows all statuses in one list, but doesn't add search).
- Reopening a resolved/closed ticket (also Story 37's territory, not this one).
