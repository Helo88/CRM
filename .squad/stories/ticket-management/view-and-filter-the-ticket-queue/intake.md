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
```

---

## Acceptance criteria

```
- An agent's queue defaults to their own assigned tickets; an account
  granted `tickets:view_all` sees every ticket across every agent instead,
  with an added "Assigned to" column.
- Filterable by status, category, and priority, and sortable by any of
  those plus last-updated.
- Each row surfaces reply (Story 56) and escalate (Story 12) actions;
  reassign (`tickets:reassign`) and delete (`tickets:delete`) only appear
  for accounts granted that permission.
- List is paginated using `platform` Story 59's shared pagination
  component and query-param contract.
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

- **Blocked by / related ids:** `platform` Story 59 (shared pagination component) — build/plan that first, this story consumes its component and query-param contract. Story 9 (categorize and prioritize) and Story 58 (manage categories) supply the category/priority values being filtered on. Story 56 (reply) and Story 12 (escalate) are the actions surfaced per row — those can be stubbed/linked-but-not-yet-functional if planned before this story, but the icon buttons and their destinations belong here.
- **Depends on code areas or other stories:** `backend/src/routes/ticket.routes.ts` (`GET /` — currently a `501` stub, this story is what actually implements it), `backend/src/models/Ticket.ts` (`status`, `category`, `priority`, `assignedAgent` — all the fields being filtered/sorted on already exist on the schema), `backend/src/constants/permissions.ts` (`tickets:view_all`, `tickets:reassign`, `tickets:delete` are already reserved keys — this is the first story to actually consume `tickets:view_all` for scoping the query).

## Extra notes (optional)

- This is the piece of `ticket.routes.ts`'s `GET /` stub referenced by multiple other stories' intakes (Story 9's old intake explicitly called out "'filtered and sorted' is a `GET /` query-parameter concern on the existing ticket list stub" — that concern now formally belongs here, not Story 9).
- The two mockup screenshots (agent vs. sub-admin) are the SAME table component with a permission-driven column/action set, not two separate pages — see the "Frontend" bullet below. Build one table, conditionally rendering the "Assigned to" column and the reassign/delete icon buttons based on the caller's granted permissions (returned from `/auth/me` or wherever the frontend already knows the current user's permission set — check `frontend/lib/` for the existing pattern from `security-admin` work before inventing a new one).
- The mockup's SLA column is a preview only — `sla-automation` Story 27 doesn't exist yet, so this story either omits that column or renders it as a static placeholder; don't build real SLA calculation here.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `GET /api/v1/tickets` query params: `status`, `category`, `priority`, `sort` (e.g. `sort=-updatedAt`), plus Story 59's `page`/`limit`. Scoping: if caller lacks `tickets:view_all`, force `assignedAgent: req.user.id` into the Mongo query server-side regardless of what the client sends — never trust a client-supplied "show all" flag.
- Gate with `requirePermission` per `[[feedback_every_route_needs_permission]]`: base viewing needs at minimum `requireAuth` + role check (agent/admin), with `tickets:view_all` as an *additional* permission that widens scope rather than gating access to the route entirely (an agent without it still sees the route, just narrowed to their own tickets).
- Frontend: the ticket queue page (e.g. `frontend/app/agent/tickets/page.tsx` or wherever the agent workspace routes live — check `agent-workspace` Story 20's eventual dashboard location so this doesn't end up duplicated once that story lands) using the shadcn `table` primitive, matching the columns/badges in the attached screenshots (status/priority/category chips, avatar+name for customer, icon-button actions).

## Out of scope

- The reply composer and escalate flow themselves (Stories 56, 12) — this story only wires up the entry-point buttons/links.
- SLA calculation/display (`sla-automation` Story 27).
- The unified agent+chat dashboard (`agent-workspace` Story 20) — this is the ticket-only queue; Story 20 may later combine this with live-chat's equivalent list.
