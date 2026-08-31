# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace/manually-reassign-a-ticket/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Agent Workspace
- **Feature slug (folder under `plans/`):** `agent-workspace`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `25` *(Story 25 in USER_STORIES.md — scoped down to tickets only for this pass, same convention as Story 21 "Agent availability toggle, scoped down")*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `agent-workspace, ticket-management`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Manually reassign a ticket
```

---

## Description

```
As an agent or admin, I want to manually reassign a ticket to a different
agent, so that work can be rebalanced when an agent is overloaded, goes
offline mid-item, or the wrong specialist ended up with it.

Scope note: USER_STORIES.md's Story 25 covers both tickets AND live chat
("Manually reassign a ticket or chat"). This story is scoped to TICKETS
ONLY — chat/conversation reassignment is explicitly out of scope (see
below), same reasoning Story 21 ("Agent availability toggle") was scoped
down from the full agent-workspace dashboard.
```

---

## Acceptance criteria

```
- Reassignment is available from TWO places: the ticket detail page
  (/tickets/[id]) and inline in the staff ticket queue table
  (/tickets — StaffTicketQueue.tsx). Both use the same underlying action;
  this is not two separate features.
- Both surfaces render a dropdown of assignable agents, not a text input.
  Includes an "Unassigned" option to explicitly clear the assignment.
- An admin, or a sub-admin/agent holding the tickets:reassign permission
  (this permission key already exists in
  backend/src/constants/permissions.ts and is already checked in the
  frontend UI — see canReassign in frontend/app/tickets/page.tsx — but
  nothing currently happens when the caller has it; the reassign icon in
  StaffTicketQueue.tsx is a disabled "Coming soon" stub today), can open
  the dropdown.
- Availability rule (mirrors USER_STORIES.md Story 25's own distinction,
  extended to sub-admin):
  - admin: can reassign to ANY active agent regardless of isOnline status.
  - sub-admin holding tickets:reassign: SAME as admin — any active agent,
    online or not. This is the explicit new requirement driving this
    story: an admin/sub-admin doing a manual reassignment is explicitly
    handling the "nobody is online" or "the right specialist is offline"
    case, so it must not be restricted to online agents the way
    auto-assignment (assignment.service.ts) is.
  - agent holding tickets:reassign (peer-level reassignment, not
    admin/sub-admin): restricted to reassigning to another agent CURRENTLY
    MARKED ONLINE, per USER_STORIES.md Story 25's original AC. Do not
    relax this restriction for a plain agent caller — only for
    admin/sub-admin.
- Reassignment is logged (who changed it, from whom, to whom, when) —
  console.info-level logging is sufficient, matching the existing
  category/priority change logging in ticket.routes.ts's PATCH /:id. A
  full audit-trail UI is Story 13 ("View full ticket history"), not this
  story.
- Both the previous assignee (if any, and if different from the new one)
  and the new assignee are notified. This story is being built
  immediately after Story 54 ("In-app notifications for ticket events"),
  which introduces Notification / createTicketNotification(...) — reuse
  that mechanism (extend NotificationType with a new
  "ticket_reassigned"-style value) rather than building a second
  notification path. If Story 54 has not actually landed yet when this is
  implemented, treat it as a hard dependency, not something to
  re-implement inline.
- In the ticket queue table (StaffTicketQueue.tsx), the "Assigned to"
  column's agent name becomes a clickable link to that agent's account
  page (/admin/users/[id]/edit) — but ONLY when the viewer can actually
  reach that page (admin, or holds staff:view_account) — never render a
  link a click would just bounce off of (matches the existing convention
  documented in frontend/lib/staffNav.ts for exactly this reason). When
  the viewer lacks that permission, keep the current plain-text name.
```

---

## Attachments

None.

---

## Dependencies

- **Blocked by / related ids:** Story 54 (in-app-notifications-for-ticket-events, already planned at
  `.squad/plans/ticket-management/26-story-in-app-notifications-for-ticket-events.md`) — this story's
  notification step calls into that story's `createTicketNotification` helper
  and extends its `NotificationType` union; plan/build this story AFTER
  Story 54 lands, not in parallel.
- **Depends on code areas or other stories:**
  - `backend/src/constants/permissions.ts` — `tickets:reassign` already exists in `PERMISSION_KEYS`, already assignable to both `agent` and `subadmin` (not in `SUBADMIN_ONLY_PERMISSIONS`), already in `DEFAULT_PERMISSIONS_BY_ROLE.agent`. No new permission key needed.
  - `backend/src/routes/ticket.routes.ts` — `PATCH /:id` already exists (category/priority) with the exact per-field-permission-check pattern this story extends; `GET /` (staff list) and `GET /:id` currently do NOT populate `assignedAgent` with a name, only the raw id — this story needs that.
  - `backend/src/services/assignment.service.ts` — `pickNextAvailableAgent` is the auto-assignment picker (Story 10/17), NOT to be reused or modified for manual reassignment; manual reassignment is a deliberately separate, unrestricted-by-online-status code path.
  - `frontend/app/tickets/page.tsx` — already computes `canReassign` and passes it to `StaffTicketQueue`, currently unused beyond gating the disabled stub icon.
  - `frontend/app/tickets/StaffTicketQueue.tsx` — the disabled `Repeat` icon button (title="Coming soon") is the exact stub this story replaces with a working dropdown.
  - `frontend/app/tickets/[id]/TicketDetailSidebar.tsx` and `frontend/app/tickets/[id]/actions.ts` — the category/priority Select + server-action pattern this story's new "assigned agent" Select should mirror exactly (fetch-on-mount, save-on-change, no submit button).
  - No existing endpoint cleanly lists "just agents, regardless of caller's staff:view_list" — `GET /admin/users` is gated on `staff:view_list`, which a reassign-permitted account has no reason to also hold. A new minimal endpoint is needed for the dropdown's data source.

## Extra notes (optional)

- The disabled icon in the ticket queue today is literally `<Repeat className="size-4" />` from `lucide-react` (a loop/circular-arrows icon) — that ambiguity is exactly what prompted this story; it should become the live control described above, not just get a tooltip explaining what it will do.
- Do not restrict the new "list assignable agents" endpoint to online agents — the whole point of manual reassignment is handling an offline agent.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Suggested new endpoint: `GET /api/v1/tickets/assignable-agents`, gated by `requirePermission("tickets:reassign")`, registered BEFORE `GET /:id` in the router (otherwise Express matches `/:id` first). Returns `{ id, name }[]` for every `role: "agent", isActive: true, isDeleted: false` user, sorted by name, regardless of `isOnline`.
- `PATCH /:id`'s body schema (`backend/src/validation/ticket.schema.ts`'s `updateTicketBodySchema`) needs a new optional nullable `assignedAgent` field (a valid ObjectId string, or `null` to unassign) alongside the existing `category`/`priority` fields, validated the same "presence checked against the raw body" way those two already are.

## Out of scope

- Live-chat / conversation reassignment (the other half of USER_STORIES.md's Story 25) — deferred to whenever live-chat's own reassignment need is actually scoped; do not build it speculatively here.
- Story 13 (full ticket audit-trail UI) — this story's "logged" requirement is console-level only, not a UI.
- Story 12 (escalate a ticket) — a separate, not-yet-built action; do not conflate reassignment with escalation.
- Bulk/multi-select reassignment — one ticket at a time only.
