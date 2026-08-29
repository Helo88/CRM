# Story intake

- Folder: `.squad/stories/ticket-management/manage-ticket-categories-and-priorities/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `58` *(Story 58 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ticket-management`

---

## Title

```
Manage ticket categories and priorities
```

---

## Description

```
As an admin, I want to define the list of ticket categories and priority
levels, so that Story 9's categorization has real, business-relevant
options to choose from instead of nothing to pick.
```

---

## Acceptance criteria

```
- Categories and priority levels can be added, renamed, and deactivated —
  not hard-deleted, so history on tickets already using one stays intact.
- Deactivating one only removes it from the picker for new assignments;
  existing tickets keep showing it.
- This is a narrower, ticket-specific slice of Story 48's system
  configuration, built here first so ticket-management isn't blocked on
  the much-later `platform` feature.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None yet — this admin screen wasn't part of the "Ticket Views" mockup pass (that covered the customer/agent/sub-admin ticket list and detail screens, not category administration). Add a screenshot here if one gets made before planning.

---

## Dependencies

- **Blocked by / related ids:** None strictly — but Story 9 (categorize and prioritize a ticket) and Story 57 (create a ticket on behalf of a customer) both read this story's category list for their pickers, so build this one first even though its number is higher (see the `ticket-management` numbering note in `USER_STORIES.md`). Related: `security-admin` Story 48 (system configuration) is the eventual umbrella settings screen — this story's categories/priorities live there visually once Story 48 exists, but Story 48 is far later in the build order and must not block this.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`category: string | null` is currently free-text — this story adds the source-of-truth list it should be validated/selected against; `priority` is already a fixed enum `"low"|"medium"|"high"|"urgent"` on the schema, so "priority levels can be added/renamed" needs a decision — see Extra notes). `backend/src/constants/permissions.ts` (needs a new `tickets:manage_categories` key).

## Extra notes (optional)

- **Open design question the plan needs to resolve:** `Ticket.priority` is currently a fixed 4-value enum in the Mongoose schema (`low/medium/high/urgent`), not a configurable list. If priority levels are meant to be truly admin-editable (rename/add), the schema needs to change from an enum to a reference/free-text field backed by a new `TicketPriorityLevel` collection, mirroring whatever new `TicketCategory` model this story adds for categories. If that's a bigger change than this story should take on, an acceptable scoped-down version is: categories become a real manageable collection now; priority stays the fixed 4-value enum for this pass, with "priority levels configurable" narrowed to categories only and flagged as a known gap. Pick one and say which in the plan — don't silently do the smaller scope without noting it.
- New `tickets:manage_categories` permission key: add it to `PERMISSION_KEYS` in `backend/src/constants/permissions.ts` AND to `SUBADMIN_ONLY_PERMISSIONS` (this is an admin/system-configuration-tier action, not a day-to-day agent one — same tier as `config:edit`/`sla:configure`, per the existing convention in that file).
- Deactivation, not deletion: add an `active: boolean` (default `true`) field to the new category model rather than removing documents, so existing tickets' `category` references keep resolving.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- New model: `backend/src/models/TicketCategory.ts` (`name: string`, `active: boolean`, timestamps) — follow the existing model conventions in `backend/src/models/` (e.g. `Ticket.ts`'s `Document`-extending interface pattern).
- New route file or additions to `ticket.routes.ts`: CRUD endpoints for categories (`GET/POST/PATCH` under something like `/api/v1/ticket-categories`), gated by `requirePermission("tickets:manage_categories")` per `[[feedback_every_route_needs_permission]]`.
- Frontend: an admin-only settings page (new route under `frontend/app/admin/...`, following the existing admin page patterns already in that directory) listing categories with add/rename/deactivate controls.

## Out of scope

- `security-admin` Story 48's full system-configuration screen (SLA defaults, quick-reply library, branding) — this story only covers the ticket category/priority slice of it.
- Retroactively re-categorizing existing tickets when a category is deactivated.
