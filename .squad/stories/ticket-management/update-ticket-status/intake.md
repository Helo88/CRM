# Story intake

- Folder: `.squad/stories/ticket-management/update-ticket-status/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `11` *(Story 11 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ticket-management`

---

## Title

```
Update ticket status
```

---

## Description

```
As an agent, I want to move a ticket through statuses (New → In Progress →
Answered → Closed), so that everyone can see where it stands.
```

---

## Acceptance criteria

```
- Moving to "Answered" normally happens automatically when an agent sends
  a reply (Story 56), though an agent can also set status manually.
- Status changes are logged with who made the change and when.
- Customers see the current status when viewing their ticket (Story 36).
- Closing a ticket doesn't delete it — it remains viewable read-only.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 8 (submit a ticket). Story 36 (customer-portal, "Track ticket status from the portal") is a much later story — this story only needs to make status queryable/visible via the API; Story 36 builds the actual portal UI on top of it.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`status: TicketStatus = "new"|"in_progress"|"answered"|"escalated"|"closed"` — note the model's actual enum includes `"escalated"`, which is not in this story's literal "New → In Progress → Answered → Closed" sequence; `"escalated"` is Story 12's concern, this story's transitions are the other four values), `backend/src/routes/ticket.routes.ts`.

## Extra notes (optional)

- Two permission keys, not one: `tickets:change_status` covers New/In Progress/Answered transitions; `tickets:close_reopen` specifically covers closing and reopening. This split (from an earlier permission-model discussion) lets an account be granted day-to-day status updates without also being able to close/reopen tickets, or vice versa. Add both keys to `PERMISSION_KEYS`, both to `DEFAULT_PERMISSIONS_BY_ROLE.agent`, neither to `SUBADMIN_ONLY_PERMISSIONS`.
- "Logged with who made the change and when" needs a place to store that — there is no dedicated status-history sub-document on `Ticket.ts` yet. Options: add a minimal `statusHistory: [{ status, changedBy, changedAt }]` array to the schema (smallest change that satisfies the acceptance criteria), or treat this as feeding Story 13's "full ticket history" model if that's judged the right home instead. State the decision explicitly rather than silently picking one.
- "Closing doesn't delete it, stays read-only" — no delete endpoint exists on tickets currently, so this is really about making sure a `"closed"` ticket can still be fetched by `GET` and that no future PATCH endpoint allows further edits once closed (or at minimum, this story doesn't add a delete path).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- New permission key `tickets:change_status` in `backend/src/constants/permissions.ts`, added to `DEFAULT_PERMISSIONS_BY_ROLE.agent`. Gate the endpoint with `requirePermission("tickets:change_status")` per `[[feedback_every_route_needs_permission]]`, not a bare `requireRole("agent", "admin")`. Story 56 ("reply to a ticket," same feature) also flips status to `"answered"` internally when a reply is sent and closed — if Story 56 is planned/built first, expose this story's status-set logic as a reusable function it can call, rather than duplicating the transition logic.

## Out of scope

- The `"escalated"` status transition itself (Story 12, separate story) — this story's valid transition set is New → In Progress → Answered → Closed only.
- The customer-portal status view (Story 36, separate, much later story).
