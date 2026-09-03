<!-- hand-authored by Claude Sonnet 5 in Claude Code, at 2026-09-01, per explicit user instruction to skip squad-kit's planner for this story -->

# Story 63 — Track how a ticket was created

---

## Prerequisites

- Story 8 completed: customer self-submit path exists (`backend/src/routes/ticket.routes.ts` `POST /`, ~lines 69-263).
- Story 57 completed: staff-create-on-behalf-of-a-customer path exists in the same handler, gated by `tickets:create_for_customer`, distinguished internally by `isStaffCreated` (line 75) — that boolean is computed per-request today and never persisted.
- Story 62 completed: `sourceConversation` field already exists on `Ticket` (`backend/src/models/Ticket.ts` line 42, schema at line 85) as a precedent for "provenance-only, never consumed by a query filter, null on legacy docs" fields — this story's two new fields follow the same shape.
- No dependency on Story 13 (view full ticket history) — that story is NOT yet planned/implemented. This story ships independently; Story 13, whenever it's built, should treat `createdBy`/`createdVia` as the first entry in the trail it assembles (see USER_STORIES.md Story 13's added bullet).

---

## Story Goal

Give every ticket a persisted, first-class record of **who actually created it** and **how**, instead of the current state where that fact is computed transiently at request time (`isStaffCreated`) and then discarded. Specifically:

1. `Ticket.createdBy` (`ObjectId`, ref `User`) — the account that actually submitted the ticket: the customer themself for a self-submitted ticket (Story 8), or the staff member who logged it on the customer's behalf (Story 57).
2. `Ticket.createdVia` (enum) — `"customer_portal" | "phone" | "email" | "in_person" | "other"`. Self-submitted tickets are always `"customer_portal"`. Staff-created tickets require the agent/admin to pick one of the other four — mirrors Story 57's own language ("reported by phone, in person, or through another channel").

Per user direction (2026-09-01), this also covers the natural surface area that follows from persisting the field at all — not left for a later story:
3. A **source column and filter** in the staff ticket queue (`StaffTicketQueue.tsx`/`TicketFilterBar.tsx`), the same first-class treatment as status/category/priority — not a lesser afterthought.
4. Removing the redundant "Reply" quick-action icon from the queue row (reply stays a detail-page-only action).
5. A **visual redesign of the filter bar** itself, both to fit the new source filter in nicely and, more broadly, so it reads as intentionally designed and has room for future filters — not a bolt-on.
6. Showing the creation channel as a small badge+icon next to the ticket **subject** in the detail view (not buried in the sidebar).

**Not in scope:** any new automated intake channel. This does not add inbound-email-to-ticket or phone-call-to-ticket automation — those stay out of scope per this platform's channel notes (only email and live chat are real channels; email here means "the customer emailed/called support and a staff member is now logging it," a metadata label, not a new connector). Also not in scope: backfilling `createdBy`/`createdVia` on tickets that already exist — they stay `null` and the UI shows "Unknown"/no badge, never a guess. Also not in scope unless the user separately confirms it: applying the filter-bar redesign to `CustomerFilterBar.tsx`/`AdminUsersFilterBar.tsx` — this story's ask was tickets specifically.

---

## Context — Read These Files First

1. `backend/src/models/Ticket.ts` (103 lines, full file) — add the two new fields next to `sourceConversation` (interface at line 42, schema at line 85), same `default: null` pattern.
2. `backend/src/routes/ticket.routes.ts`:
   - `POST /` handler, ~lines 69-263. `isStaffCreated` (line 75) already exists — reuse it as the source of truth for which branch to require `createdVia` from. `Ticket.create({...})` call at ~lines 150-158 is where the two new fields get set.
   - `TicketDetailFields` type (~line 454) and `toTicketDetailResponse()` (~line 466) — shared by every detail-response call site; add `createdBy` here once.
   - GET `/:id` handler (~lines 518-550) — add a third `.populate<{ createdBy: {...} }>("createdBy", "name")` call, same pattern as the existing `customer`/`assignedAgent`/`escalatedTo` populates at lines 528-536.
   - The other 4 call sites that build a ticket-detail response via `.populate<{...}>()` + `toTicketDetailResponse(populated, ...)` — grep `toTicketDetailResponse` to find all of them (currently ~lines 683, 788, 838, 879) — each needs the same `createdBy` populate added to its chain.
3. `backend/src/validation/ticket.schema.ts` — `createTicketBodySchema` (~lines 27-45) deliberately excludes staff-only fields (comment at line 23: "customerId/priority/notifyCustomer are staff-only... validated inline in ticket.routes.ts"). Add `createdVia`'s validation the same way — inline in the route, not in this shared schema — since its required-ness depends on `isStaffCreated`, exactly like `customerId`/`priority` already do. Also add `createdVia` as a new optional field to `listTicketsQuerySchema` (~lines 73-90) for the queue filter.
4. `frontend/app/tickets/new/SubmitTicketForm.tsx` — staff-mode fields (`priority`, `notifyCustomer`) live here, gated on the same "is this staff mode" condition as `customerId`. Add the new "How did the customer contact you?" select next to them.
5. `frontend/app/tickets/StaffTicketQueue.tsx`:
   - Table columns at ~lines 157-165 (Reference, Customer, Subject, Category, Priority, Status, [AssignedTo], Updated). Add a real source column.
   - Row actions cell, ~lines 217-262 — the "Reply" `Button`/`Link` (~lines 219-230, `MessageSquare` icon, `title={t("reply")}`) is removed per Frontend Task 4 below; Escalate (~lines 231-242)/Reassign (~lines 243-249)/Delete (~lines 250-260) stay.
6. `frontend/app/tickets/TicketFilterBar.tsx` — the filter bar this story adds a `createdVia` filter to and redesigns (Frontend Tasks 2-3). Already has the "own isolated Reset row" fix from [[feedback_reset_filter_button_convention]] applied — preserve that when redesigning, don't regress it back into the flex-wrap flow.
7. `frontend/app/tickets/page.tsx` — must forward the new `createdVia` filter param end-to-end, same as every other filter (see the reminder in Frontend Task 2 and [[feedback_wire_filter_params_end_to_end]]).
8. `frontend/app/tickets/[id]/page.tsx` — where the ticket detail's subject heading renders; this is where the new channel badge (Frontend Task 5) gets placed, not in the sidebar.
9. `frontend/app/tickets/[id]/TicketDetailSidebar.tsx` — only needed if `createdBy`'s name ends up shown here (see Frontend Task 5's note) — the channel badge itself does NOT go here.
10. `frontend/messages/en.json` / `ar.json` — `Tickets` namespace (grep `columnAssignedTo` / `statusEscalated` for exact insertion points) and the ticket-submission form's namespace (grep `notifyCustomer` in both files) — add every new label to both locales in the same change, per this repo's i18n convention.

---

## Product rules (from story)

- **Current behavior:** `isStaffCreated` is computed from `req.user!.role` at request time (`ticket.routes.ts:75`) and used only to pick email templates/defaults — it is never written to the `Ticket` document. There is no way, after the fact, to tell a staff-created ticket from a self-submitted one except by an indirect, undocumented inference (comparing `statusHistory[0].changedBy` to `customer`), and no way at all to know *how* staff learned about it.
- **New behavior:** `createdBy` and `createdVia` are set once, at creation, and never change afterward (not editable — this is a historical fact, not a mutable ticket property, same treatment as `sourceConversation`). Staff creation requires picking a `createdVia` value; the request is rejected with 400 if a staff caller omits it or sends a value outside the four staff options. A customer's own submission always gets `createdVia: "customer_portal"` server-side — never client-supplied for that branch.

---

## Backend Tasks

### 1 — Add fields to the Ticket model

In `backend/src/models/Ticket.ts`, add a new exported union type near `TicketStatus`/`TicketPriority`:

```ts
export type TicketCreationChannel = "customer_portal" | "phone" | "email" | "in_person" | "other";
```

Add to `ITicket`, next to `sourceConversation`:

```ts
createdBy: Types.ObjectId | null;
createdVia: TicketCreationChannel | null;
```

Add to the schema, next to `sourceConversation`:

```ts
createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
createdVia: { type: String, enum: ["customer_portal", "phone", "email", "in_person", "other"], default: null },
```

`null`-able and `default: null` (not `required: true`) so existing tickets remain valid documents without a migration/backfill script.

### 2 — Set the fields at creation

In `POST /` (`ticket.routes.ts`, ~line 69 onward):

- In the `isStaffCreated` branch (~lines 86-123, alongside the existing `priority`/`notifyCustomer` staff-only field handling): read `req.body?.createdVia`, validate it's one of `"phone" | "email" | "in_person" | "other"` (reuse the same `res.status(400)` pattern already used for an invalid `priority`), reject with 400 if missing or invalid — this is a required field for this branch, not optional like `priority`.
- In the customer branch (~lines 124-130): no client input needed — hardcode `createdVia = "customer_portal"`.
- At the `Ticket.create({...})` call (~line 150), add:
  ```ts
  createdBy: creatorId, // the existing `creatorId` local (line 149) already holds exactly this value
  createdVia,
  ```
  (`creatorId` is already computed one line above for `statusHistory[0].changedBy` — reuse it verbatim rather than recomputing.)

### 3 — Return the fields in detail/list responses

- `TicketDetailFields` (~line 454): add `createdVia` to the `Pick<ITicket, ...>` list, and add `createdBy: { _id: Types.ObjectId; name: string } | null` to the type intersection (same shape as `escalatedTo`).
- `toTicketDetailResponse()` (~line 466): add
  ```ts
  createdBy: ticket.createdBy ? { id: ticket.createdBy._id.toString(), name: ticket.createdBy.name } : null,
  createdVia: ticket.createdVia,
  ```
- Add `.populate<{ createdBy: { _id: Types.ObjectId; name: string } | null }>("createdBy", "name")` to the GET `/:id` handler's populate chain (~line 536) and to every other call site that builds a `toTicketDetailResponse(populated, ...)` (grep `toTicketDetailResponse` — currently 4 more sites).
- List response (`GET /`, ~line 355-356): add `createdVia` as a plain field (no populate needed — the queue only needs the enum value to render a compact source indicator, not the creator's name) to the `.select()`/response mapping used there.

### 4 — Tests

Extend `backend/tests/routes/ticket.routes.test.ts`:
- Customer self-submit sets `createdBy` to the customer and `createdVia` to `"customer_portal"` — client cannot override this.
- Staff create-on-behalf without `createdVia` → 400.
- Staff create-on-behalf with an invalid `createdVia` (e.g. `"customer_portal"`, which staff must not be able to claim) → 400.
- Staff create-on-behalf with a valid `createdVia` (e.g. `"phone"`) → 201, `createdBy` is the staff user's id, `createdVia` round-trips correctly through GET `/:id`.
- A ticket seeded without `createdBy`/`createdVia` (simulating a pre-existing document) still returns 200 from GET `/:id` with both fields `null` — confirms no migration is required for old data.

---

## Frontend Tasks

### 1 — Staff "create on behalf of" form

`frontend/app/tickets/new/SubmitTicketForm.tsx`: add a required `<Select>` "How did the customer contact you?" (phone / email / in person / other) in the same staff-mode-only block as `priority`/`notifyCustomer`. Submits as `createdVia` in the form action's body. Client-side required-field validation only as a UX nicety — the real validation is the 400 the backend already returns (per this repo's Server Action validation convention).

### 2 — Ticket queue: source column + filter

Per user direction (2026-09-01): this is a real column, not an icon-only compromise, and it must be filterable — treat it the same as the existing status/category/priority filters, not a lesser afterthought.

- `frontend/app/tickets/StaffTicketQueue.tsx`: add a `columnSource` column (position: after Status, before the permission-gated `AssignedTo` column, ~line 162) rendering a `Badge`:
  - `createdVia === "customer_portal"` → "Customer" badge (a neutral/secondary variant, matching the existing `category` badge's `variant="secondary"` at line 187 — this is provenance, not a status, so it should not compete visually with the status/priority badges' semantic colors).
  - any staff value → "Staff · Phone" / "Staff · Email" / "Staff · In person" / "Staff · Other".
  - `null` (legacy ticket) → "Unknown," muted, same tone as `unassigned`/`uncategorized` fallbacks elsewhere in this table.
- Backend: add `createdVia` as a new optional filter param on `GET /tickets` (`listTicketsQuerySchema` in `ticket.schema.ts`, enum `["customer_portal", "phone", "email", "in_person", "other"]`, optional) — apply it in `ticket.routes.ts`'s staff branch alongside the existing `category`/`priority` filters (~lines 303-304), and include it in `countFilter` the same way those two already are so the status quick-filter-chip counts stay consistent with the applied source filter.
- Frontend filter bar: add a `createdVia` `<Select>` to `TicketFilterBar.tsx` inside the same wrap-row as status/category/priority (see Task 3 below for the row's overall redesign) — same `updateParam("createdVia", v)` pattern as the existing filters, same active-filter highlight treatment.
- **Reminder:** per [[feedback_wire_filter_params_end_to_end]] (a bug found and fixed in this same repo, same day) — when adding this filter, verify `frontend/app/tickets/page.tsx` actually forwards `createdVia` into the backend fetch (`TicketListSearchParams` interface + `currentQuery`), not just the filter bar and the backend schema. This is exactly the class of bug that memory documents.

### 3 — Filter bar redesign (visual pass, not just adding one more field)

Per user direction (2026-09-01): the filter section needs a genuine visual redesign — "nicer," and structured so more filters can be added later without becoming an unreadable wall of dropdowns. This is a design decision, not a mechanical change — per [[feedback_ui_design_options_before_build]], sketch 2-4 concrete layout options (e.g., a denser grid with grouped labels; a "primary filters visible + More filters" collapsible/popover pattern; a redesigned single-row-per-breakpoint layout with clearer visual grouping between "what" filters (status/category/priority/source) and "when" filters (date ranges)) and get the user to pick one **before** writing the component changes. Apply whatever's chosen consistently to `TicketFilterBar.tsx`, and consider (only if the user confirms they want it applied everywhere, not just tickets) `CustomerFilterBar.tsx`/`AdminUsersFilterBar.tsx` too, per [[feedback_list_view_pattern_standard]] — but tickets is explicitly what was asked for here, don't assume the others are in scope without confirming.

### 4 — Remove the "Reply" quick-action from the queue row; keep it in ticket detail only

`frontend/app/tickets/StaffTicketQueue.tsx` (~lines 219-230): delete the `MessageSquare`-icon "Reply" button (a `Link` to `/tickets/${ticket.id}#reply`) from the row-actions cell. It's redundant now that the row's own Reference/Customer/Subject cells already link to the ticket detail page, and per user direction this action belongs on the detail page only. The reply composer itself (`frontend/app/tickets/[id]/TicketReplyComposer.tsx`) is unaffected — this only removes the queue-row shortcut icon, not the reply feature. Remaining row actions (Escalate, Reassign, Delete) are untouched. Remove the now-unused `t("reply")`/`MessageSquare` import if nothing else in the file uses them.

### 5 — Ticket detail: channel as a badge next to the subject, not a sidebar line

Per user direction (2026-09-01), superseding the sidebar-line approach originally sketched here: the creation channel (`createdVia`) is shown **only** in ticket detail (not the sidebar's status/category/priority block) — as a small badge with a suitable icon (e.g. `Phone`/`Mail`/`MapPin`/`CircleEllipsis` from `lucide-react` for phone/email/in-person/other, and no badge at all — or a neutral "Customer"-tone badge, to be decided alongside Task 3's design pass — for `customer_portal`), placed on the **same line as the ticket subject** at the top of the ticket detail view (`frontend/app/tickets/[id]/page.tsx` — grep where the subject heading renders), not in `TicketDetailSidebar.tsx`. `createdBy`'s name is a separate concern from the badge — if shown at all, it belongs in the sidebar (only for staff-created tickets, where it's informative — see the reasoning kept from the original draft of this task), while the channel badge is what sits next to the subject. Legacy tickets (`createdVia: null`) show no badge at all, rather than an "Unknown" badge cluttering the subject line.

### 6 — i18n

Add to both `frontend/messages/en.json` and `frontend/messages/ar.json` in the same change (per this repo's i18n convention — never let the two drift): the new form label + 4 channel options, the queue column header + per-value badge labels, the new filter's label + options, and the detail-view channel badge labels.

---

## Done Criteria

- [x] `createdBy`/`createdVia` added to `Ticket` model, both nullable, no migration required.
- [x] `POST /tickets` sets `createdVia: "customer_portal"` for customer self-submit, unconditionally (never client-supplied for that branch).
- [x] `POST /tickets` requires a valid staff `createdVia` (`phone`/`email`/`in_person`/`other`) when staff-created; rejects missing/invalid with 400; rejects a staff caller trying to send `"customer_portal"`.
- [x] `createdBy` is set to the actual creator (customer or staff user id) on every new ticket, reusing the existing `creatorId` local rather than recomputing it.
- [x] GET `/:id` and every other `toTicketDetailResponse` call site returns populated `createdBy` (`{id, name}` or `null`) and `createdVia`.
- [x] GET `/` (list) includes `createdVia` per row (no populate needed) and accepts an optional `createdVia` filter param, scoped/counted the same way `category`/`priority` already are.
- [x] Staff "create on behalf of" form requires picking a contact method; customer's own submit form is unchanged (no new field shown to customers).
- [x] Ticket queue has a real, always-present source **column** (never blank) — "Customer," "Staff · `<method>`," or "Unknown" for legacy tickets — and a matching filter dropdown in the filter bar, fully wired end-to-end (filter bar → `page.tsx` → backend), verified per [[feedback_wire_filter_params_end_to_end]]'s lesson rather than assumed.
- [x] Filter bar redesign: superseded — the redesign this task asked for had already shipped separately earlier the same day (`f26cf1c`, the "Concept C" full-screen filter dialog); user confirmed (2026-09-01) to reuse it rather than re-run the 2-4-option picker, so the Source filter was added as a new field inside that existing design instead.
- [x] "Reply" quick-action removed from the staff ticket queue row; Escalate/Reassign/Delete actions unaffected; reply composer on the detail page still works.
- [x] Ticket detail view shows the creation-channel badge (with icon) on the same line as the subject; no badge shown for legacy tickets with `createdVia: null`.
- [x] EN and AR strings added for every new label, in the same change.
- [x] New/updated backend tests pass; `npm run build` succeeds in both `backend/` and `frontend/`.
- [x] Verified against the real local dev backend + MongoDB: created a ticket via customer self-submit (shows "Customer" badge) and via staff-on-behalf-of with `phone`/`in_person` (shows "Staff · Phone"/badge+icon on detail view), confirmed the required-field error and successful submission in a real browser session, and confirmed a ticket seeded before this change (no `createdBy`/`createdVia`) renders "Unknown" in the queue with no badge on its detail page.
