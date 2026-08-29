# Story intake

- Folder: `.squad/stories/ticket-management/create-a-ticket-on-behalf-of-a-customer/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `57` *(Story 57 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ticket-management`

---

## Title

```
Create a ticket on behalf of a customer
```

---

## Description

```
As an agent or admin, I want to open a ticket on behalf of a customer, so
that I can log an issue reported by phone, in person, or through another
channel without asking them to submit it themselves.
```

---

## Acceptance criteria

```
- Form requires picking the customer plus subject, category, and
  description — same fields as Story 8, but the category picker is
  populated from Story 58, and priority is also settable up front (Story
  8's version leaves priority for Story 9 to set later).
- Customer can optionally be notified by email that a ticket was opened on
  their behalf.
- The created ticket behaves identically to a customer-submitted one — same
  statuses (Story 11), same visibility to the customer (Story 36).
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| `attachments/agent-list-toolbar.png` | "＋ Create for customer" toolbar button as it appears on the agent ticket queue (Story 60) — the entry point into this story's form. Add manually from the approved "Ticket Views" mockup. |
| `attachments/subadmin-list-toolbar.png` | Same button on the sub-admin queue. Add manually. |

*(Both screenshots are in place under `attachments/`.)*

---

## Dependencies

- **Blocked by / related ids:** Story 8 (submit a ticket) — this story extends the same form/endpoint rather than duplicating it; build Story 8 first. Story 58 (manage ticket categories) — the category picker here should read from Story 58's list once it exists; if Story 58 isn't built yet, fall back to the same free-text category Story 8 uses and flag the picker as a follow-up. Story 4 (view/edit a customer profile, `customer-management`) — already shipped; the customer-picker in this form is a lookup against the existing customer roster, not a new customer-search feature.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`customer: Types.ObjectId` — already there, just needs to be settable to an arbitrary customer id rather than always `req.user.id`), `backend/src/routes/ticket.routes.ts` (`POST /` — Story 8's handler), `backend/src/services/email.service.ts` (the optional "notify customer" send), `backend/src/constants/permissions.ts` (needs a new `tickets:create_for_customer` key added to `PERMISSION_KEYS`).

## Extra notes (optional)

- This is the "staff mode" of the same `TicketForm` component discussed during design — not a separate page. The frontend work here should be: extend Story 8's form with a customer picker, a priority field, and a "notify customer" toggle, shown only when an agent/admin opens it (e.g. via a `mode="staff"` prop or a route param), rather than forking a second form component.
- Add `tickets:create_for_customer` to the `PERMISSION_KEYS` array in `backend/src/constants/permissions.ts` (and to `DEFAULT_PERMISSIONS_BY_ROLE.agent` so a working agent has it by default — see the existing entries for `tickets:reassign` etc.). It should NOT be added to `SUBADMIN_ONLY_PERMISSIONS` — an ordinary agent needs this day-to-day.
- Per `[[feedback_every_route_needs_permission]]` project convention: gate the new endpoint (or the existing `POST /` with a staff branch) with `requirePermission("tickets:create_for_customer")`, not a bare `requireRole("agent", "admin")`.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Likely the same `POST /api/v1/tickets` endpoint as Story 8, branching on caller role: `role === "customer"` uses `req.user.id` as the customer; `role === "agent" | "admin"` (with `tickets:create_for_customer`) requires a `customerId` in the body and looks it up. Keep the two branches in one handler if that stays clean, or split into a second route (`POST /for-customer`) if the validation shape diverges too much — either is fine, note the choice made in the plan.

## Out of scope

- Building Story 58's category management UI (that's its own story) — if Story 58 isn't done yet, use free-text category like Story 8 does.
- The "notify customer" email's exact copy/branding polish — a plain, functional notification email is enough for this pass.
