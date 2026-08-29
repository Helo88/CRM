# Story 9 — Categorize and prioritize a ticket

**Corrections applied after CLI regeneration (manual verification pass, second pass — backend now uses zod project-wide):** the CLI was re-run on this intake after a separate, deliberate backend-wide migration to `zod` for request validation (see `backend/src/middleware/validate.ts` and `backend/src/validation/*.schema.ts`, all six existing route files migrated). That migration is exactly why this story should now *use* zod — the opposite correction from the first version of this plan, which rejected zod because nothing in the codebase used it yet. That's no longer true. Line-number citations mostly checked out (`Ticket.ts`'s `category`/`priority` fields, `timestamps: true` at line 53, `permissions.ts`'s `PERMISSION_KEYS`/`SUBADMIN_ONLY_PERMISSIONS`/`DEFAULT_PERMISSIONS_BY_ROLE.agent`, `ticket.routes.ts`'s `ALLOWED_PRIORITIES` at line 14 and the `GET /` stub at lines 156–158, `ticket.schema.ts`'s `CATEGORY_MAX_LENGTH` at line 6, `seedUser` at line 32 in the test file) — all verified exact. But the regenerated draft had several real problems, fixed below:

1. **Wrong story number throughout.** The draft titled this "Story 13" and renumbered its dependencies to "Story 11"/"Story 12". Per `USER_STORIES.md` (confirmed by grep), this is **Story 9**, depending on **Story 8** (submit a ticket) and **Story 57** (staff-create); **Story 13** is a *different*, unrelated story ("View full ticket history") — the draft's renumbering would have collided this story's own identity with that one. Restored the real numbers throughout.
2. **Invented a "Story 58 not deployed yet, fall back to free-text category" branch** (`TicketCategory.exists({active:true})` short-circuit). Story 58 (manage ticket categories) is **already fully implemented** — confirmed by reading `backend/src/models/TicketCategory.ts` and `backend/src/routes/ticketCategory.routes.ts` in full, both complete and already zod-migrated. There is nothing to fall back from; this speculative branch is dropped entirely.
3. **Used zod v3's `errorMap` option**, which is not this project's zod API. This backend runs zod `^4.5.2` (confirmed in `backend/package.json` and by testing directly), whose custom-message syntax is `z.enum(values, { error: "message" })` — verified empirically (`z.enum([...], { error: "..." }).safeParse(...)` produces the custom message on failure). Fixed throughout.
4. **Split into two routes** (`PATCH /:id/category`, `PATCH /:id/priority`). This project's own just-established convention (`ticketCategory.routes.ts`'s `PATCH /:id`, handling rename and toggle-status independently in one endpoint — see `[[feedback_granular_action_permissions]]`) is **one** `PATCH` endpoint with per-field permission checks. Restored to one `PATCH /api/v1/tickets/:id`, exactly like the first version of this plan already got right.
5. **A real, non-obvious bug in both the draft and this plan's own first version:** if `category`'s zod field defaults an *absent* key to `null` (same transform `POST /` already uses for creation), then a request that changes *only* `priority` would silently blank out `category` on every save — because the schema can't distinguish "field omitted, don't touch it" from "field explicitly cleared." This is exactly the gotcha the real migration hit (and fixed) in `customer.routes.ts`'s `PATCH /:id` and `me.routes.ts`'s `PATCH /contact`: **check field presence against the raw request body**, not the parsed/transformed result, before deciding whether to touch that field at all. This plan's schema and handler design (Task 3 below) does this correctly; call this out explicitly during implementation review since it's easy to silently regress.
6. **Used `Ticket.findByIdAndUpdate(...)`.** Every other route in this codebase loads the document, mutates it, and calls `.save()` (`ticketCategory.routes.ts`'s `PATCH /:id`, `customer.routes.ts`'s `PATCH /:id`, `admin.routes.ts`'s `PATCH /:id` — all the same shape). `findByIdAndUpdate` also skips Mongoose validators unless `{ runValidators: true }` is explicitly passed. Switched to load + mutate + `.save()` for consistency and correctness.
7. **Dropped the frontend entirely again** ("No frontend changes required for this backend-first plan iteration... in a follow-up frontend story"). `CLAUDE.md` is explicit and non-negotiable: *"Every story that adds or changes a persona-facing backend capability ships its frontend UI in the same story."* No `tickets/[id]` route exists yet (confirmed). Restored the minimal ticket-detail page this story must ship, same as the first version of this plan — verified its cited precedent files (`frontend/app/tickets/new/page.tsx`'s staff-gating shape, `frontend/app/admin/ticket-categories/actions.ts`'s server-action shape, `RenameCategoryDialog.tsx`'s inline-edit shape, `listActiveTicketCategories()`'s exact export name, the `isViewerAdmin || viewerPermissions.includes(key)` boolean pattern) all still exist exactly as described.
8. **`findByNameCaseInsensitive` is still a local, non-exported function** in `ticketCategory.routes.ts` (confirmed by reading the current file) — this plan still needs to export it (or duplicate it) for the category-validation lookup, same as the first version identified.

---

## Prerequisites

- Story 58 (manage ticket categories) is **done**: `backend/src/models/TicketCategory.ts` and `backend/src/routes/ticketCategory.routes.ts` exist, are mounted at `/api/v1/ticket-categories`, and are already zod-validated. No fallback/free-text path is needed — every category value this story accepts must match an existing entry.
- Story 8/57 (submit / staff-create a ticket) done: `POST /api/v1/tickets` exists and already validates `subject`/`description`/`category` via `backend/src/validation/ticket.schema.ts`'s `createTicketBodySchema`; a ticket must exist to categorize one.
- No ticket-detail page exists yet anywhere in `frontend/app/` (confirmed — no `tickets/[id]` route). This story creates the first one, scoped to what it needs (Category/Priority editing) — not a full ticket workspace. Story 56 (reply) and Story 11 (status) will extend this same page later, not fork a second one.
- Story 13 ("View full ticket history") has **not** landed — no audit-log model exists yet. This story relies on `Ticket.updatedAt` (already automatic via `timestamps: true`) plus a `console.info` line, per Story 58's own precedent for flagging a deferred concern rather than building a second one-off mechanism.
- The backend-wide zod migration is done: `backend/src/middleware/validate.ts` (`validateBody`/`validateParams`), `backend/src/validation/common.ts` (shared `objectIdSchema`, `userIdParamsSchema`, etc.), and `backend/src/validation/ticket.schema.ts` (`createTicketBodySchema`) all exist and are the pattern to extend, not replace.

---

## Story Goal

Let an agent (or admin/subadmin holding the relevant permission) set or change a ticket's **category** and **priority** from a real ticket-detail page, using Story 58's admin-managed category list and the fixed 4-value priority enum.

Concrete outcomes:

1. A new minimal ticket-detail page at **`/tickets/[id]`**, staff-only (agent/admin/subadmin), showing the ticket's subject, description, customer, current status (read-only — editing status is Story 11's job, not shown as an interactive control here), and editable **Category** and **Priority** selects.
2. `PATCH /api/v1/tickets/:id` accepts `{ category?: string | null; priority?: "low"|"medium"|"high"|"urgent" }`. Setting category requires `tickets:categorize`; setting priority requires `tickets:change_priority` — checked independently per field, since one request could change either or both (mirrors `ticketCategory.routes.ts`'s `PATCH /:id`). A field that is *absent* from the body is left untouched; a field that is present is validated and (if valid) applied — see Task 3's presence-detection note.
3. `GET /api/v1/tickets/:id` (new — didn't exist before) returns one ticket's detail, staff-only, backing the detail page.
4. Category values are validated against Story 58's **active** category list (case-insensitive, matching `ticketCategory.routes.ts`'s collation lookup) — an inactive or unknown category name is rejected, not silently created. The canonical stored name (admin's exact casing) is written, not whatever casing the caller sent.
5. `Ticket.updatedAt` reflects every successful change (automatic via `.save()`); a `console.info` line notes who changed what, as a stand-in until Story 13's real audit trail exists.

**Not in scope:**

- Story 58's admin category CRUD (done).
- List-level filtering/sorting by category/priority, and the ticket queue itself (Story 60) — this story's `GET /:id` is a single-ticket read only.
- Editing ticket status (Story 11) — shown read-only here.
- Replying to a ticket (Story 56).
- A real audit-log/history model (Story 13) — `updatedAt` + a log line is the deliberate stand-in.
- Customer-facing category/priority editing — customers set category at creation only (Story 8); they cannot re-categorize or change priority afterward.

---

## Context — Read These Files First

1. `backend/src/models/Ticket.ts` (57 lines) — `category: string | null` (interface line 21, schema line 37), `priority: TicketPriority` (interface line 22, schema line 38), `timestamps: true` at line 53. No changes needed here.
2. `backend/src/routes/ticket.routes.ts` (161 lines) — read the whole file. Key anchors: `customerOrPermitted` helper at lines 33–41 (reference only — the new routes are staff-only, gated per-field, not via this helper); `ALLOWED_PRIORITIES` tuple at line 14 (move this into `ticket.schema.ts`, export it, and import it back here — single source of truth instead of duplicating it in the new update schema); the `POST /` handler's `validateBody(createTicketBodySchema)` wiring at line 55 (the pattern to follow, except this story's `PATCH` needs an inline `safeParse` instead — see Task 3's presence-detection note); the `GET /` stub at lines 156–158; `export default router` at line 160 — new routes go above this line, after the `POST /` handler (ends line 151).
3. `backend/src/validation/ticket.schema.ts` (36 lines) — read the whole file. `CATEGORY_MAX_LENGTH` at line 6, the `category` field's trim/max/nullable/transform chain at lines 24–30 (factor this into a shared constant both `createTicketBodySchema` and the new update schema use, so the two don't drift). `createTicketBodySchema` ends with `.passthrough()` at line 35 — the new schema doesn't need this (no staff-only sibling fields to preserve).
4. `backend/src/middleware/validate.ts` — `validateBody`/`validateParams` signatures. **Do not** use `validateBody` for the new `PATCH` route specifically — it replaces `req.body` with the parsed result, which loses the raw-body key-presence information this route's partial-update logic needs (see Task 3). Use `schema.safeParse(req.body ?? {})` inline instead, same as `admin.routes.ts`'s `PATCH /:id` and `ticketCategory.routes.ts`'s `PATCH /:id` already do for the same reason.
5. `backend/src/validation/common.ts` — `objectIdSchema`/`userIdParamsSchema` exist for *user* ids; this story's `:id` is a *ticket* id, so don't reuse those directly — either add a small `ticketIdParamsSchema` alongside them or just keep the existing `Types.ObjectId.isValid(...)` inline check `ticket.routes.ts`'s `POST /` handler already uses for `customerId` (either is fine; pick one, be consistent with the rest of this file).
6. `backend/src/routes/ticketCategory.routes.ts` (whole file, 158 lines) — this story's closest precedent. `findByNameCaseInsensitive(name, excludeId?)` (lines 25–29, collation-aware, currently **not exported**) and the `PATCH /:id` handler's per-field permission pattern: `callerHasPermission(req, key)` (lines 53–56 — admin implicit-pass via `isActiveAccount`, DB-backed `hasPermission` for others), plus its `safeParse` + raw-body-key-presence handling shape (lines 124–151) — this is the exact template for this story's `PATCH /api/v1/tickets/:id`.
7. `backend/src/constants/permissions.ts` (77 lines) — `PERMISSION_KEYS` at lines 13–36 (add two entries after `"ai:override_category"`, line 35), `SUBADMIN_ONLY_PERMISSIONS` at lines 46–62 (do **not** add the two new keys here — these are agent-tier, unlike Story 58's category-management keys), `DEFAULT_PERMISSIONS_BY_ROLE.agent` at line 74 (add both new keys here, alongside the existing `tickets:create_for_customer`).
8. `backend/src/middleware/auth.ts` — `requirePermission` (line 93) and `requireAuth` (line 46). Confirmed: admin gets an implicit pass with a live `isActive` re-check; agent/subadmin get a live DB-backed `hasPermission` check. Nothing new needed here — reused via `callerHasPermission`, not `requirePermission` directly (the required key depends on which fields are present in a given request).
9. `frontend/app/tickets/new/page.tsx` — the closest existing precedent for a staff-gated ticket page (cookie → access-token check → silent-refresh redirect → `peekJwtPayload` role check → redirect non-staff to `/dashboard`, confirmed at lines 6, 36, 38, 41, 43). The new detail page mirrors this gating shape.
10. `frontend/app/tickets/new/actions.ts` — `listActiveTicketCategories()` (confirmed, line 164) already calls `GET /api/v1/ticket-categories?active=true`; reuse/import it rather than duplicating.
11. `frontend/app/tickets/new/constants.ts` — `UNSPECIFIED_CATEGORY = "unspecified"` (confirmed) — reuse this exact sentinel value/constant for the detail page's category picker, don't invent a second one.
12. `frontend/app/admin/ticket-categories/actions.ts` and `RenameCategoryDialog.tsx` — precedent for a small "edit one field, save via server action, show inline error" interaction (cookie read, 401-retry-once, `revalidatePath`) — the detail page's Category/Priority selects follow this same shape (immediate-save on change, not a big form with a submit button).
13. `frontend/app/admin/ticket-categories/page.tsx` — the `isViewerAdmin || viewerPermissions.includes(key)` boolean pattern (confirmed lines 79–83) for gating which controls render enabled — reuse this exact shape for `tickets:categorize`/`tickets:change_priority`.
14. `frontend/components/ui/select.tsx`, `badge.tsx` — primitives already installed; reuse, don't add new ones.
15. `frontend/messages/en.json` — `"NewTicket"` namespace (confirmed, starting line 425) already has `category`, `categoryUnspecified`, `priority`, `priorityLow/Medium/High/Urgent` — reuse these exact strings via a shared key or by referencing the same translated values, don't retranslate. Add a new `TicketDetail` namespace for this page's own strings (heading, subject, description, customer, status, statusNew/InProgress/Answered/Escalated/Closed, changeSaved, changeFailed, noAccess, notFound).
16. `backend/tests/routes/ticket.routes.test.ts` — `seedUser` helper at line 32 (confirmed), `tokenFor` at line 28. Match this harness exactly.
17. `backend/tests/constants/permissions.test.ts` — its existing `describe("tickets:categories_* (Story 58)", ...)` block is the precedent for this story's own permission-tier assertions.
18. Attachment `.squad/stories/ticket-management/categorize-and-prioritize-a-ticket/attachments/agent-detail-sidebar.png` — the mockup: "TICKET" heading, then Status/Category/Priority each shown as a select-style control. Status renders as a **read-only badge** here (editing it is Story 11's job); Category/Priority are real, editable `Select`s.

---

## Product rules (from story)

- **Current behavior:** a ticket's `category`/`priority` can only be set at creation time (Story 8/57); there is no way to change either afterward, and no way to view a single ticket's detail at all.
- **New behavior:** an agent/admin can open `/tickets/[id]`, see the ticket's context, and change category and/or priority inline. Each field's permission is checked independently. Category must match an **active** entry in Story 58's list (case-insensitive) or be explicitly cleared (`null`/`""`); priority must be one of the fixed four values.

---

## Backend Tasks

### 1 — Add two new permission keys

**File:** `backend/src/constants/permissions.ts`

- Add `"tickets:categorize"` and `"tickets:change_priority"` to `PERMISSION_KEYS` (after line 35's `"ai:override_category"`), grouped with the other `tickets:*` entries.
- **Do not** add either to `SUBADMIN_ONLY_PERMISSIONS` (lines 46–62) — these are day-to-day agent actions, unlike Story 58's category-management keys.
- Add both to `DEFAULT_PERMISSIONS_BY_ROLE.agent` (line 74), alongside the existing four keys. Leave `subadmin: []` unchanged.
- No backfill script for pre-existing agent accounts — there is no production agent roster yet (only seed scripts), so this is not a real migration concern at this stage.

### 2 — Export the case-insensitive category lookup

**File:** `backend/src/routes/ticketCategory.routes.ts`

`findByNameCaseInsensitive` (lines 25–29) is currently local and non-exported. Add `export` to it so `ticket.routes.ts` can import and reuse it for validating a `category` value against Story 58's list, rather than re-implementing the same collation-aware query.

### 3 — Extend `ticket.schema.ts` and add `GET`/`PATCH /api/v1/tickets/:id`

**File:** `backend/src/validation/ticket.schema.ts`

Factor the existing category field (lines 24–30) into a shared constant, move `ALLOWED_PRIORITIES` here from `ticket.routes.ts`, and add the new update schema:

```ts
export const ALLOWED_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const categoryFieldSchema = z
  .string()
  .trim()
  .max(CATEGORY_MAX_LENGTH, `category must be at most ${CATEGORY_MAX_LENGTH} characters`)
  .nullable()
  .optional()
  .transform((val) => (val ? val : null));

export const createTicketBodySchema = z
  .object({
    subject: requiredString(REQUIRED_MESSAGE).max(/* ...unchanged... */),
    description: requiredString(REQUIRED_MESSAGE).max(/* ...unchanged... */),
    category: categoryFieldSchema,
  })
  .passthrough();

// Story 9: change category and/or priority on an existing ticket. Shape
// only — "category must match an active TicketCategory" is a DB lookup and
// stays inline in ticket.routes.ts's PATCH /:id handler (same pattern as
// every other DB-dependent rule in this codebase). Whether a field is even
// present is decided against the RAW request body in the route handler, not
// this parsed result — see the handler below for why.
export const updateTicketBodySchema = z.object({
  category: categoryFieldSchema,
  priority: z
    .enum(ALLOWED_PRIORITIES, { error: `priority must be one of: ${ALLOWED_PRIORITIES.join(", ")}` })
    .optional(),
});
```

**File:** `backend/src/routes/ticket.routes.ts`

Remove the local `const ALLOWED_PRIORITIES = [...]` (line 14) and import it from `../validation/ticket.schema` instead — update the two existing call sites (lines 81–82) accordingly.

Insert above `export default router;` (currently line 160), after the `POST /` handler (ends line 151):

```ts
import { findByNameCaseInsensitive } from "./ticketCategory.routes";
import { hasPermission, isActiveAccount } from "../services/permissions";
import { updateTicketBodySchema } from "../validation/ticket.schema";
import type { ITicket } from "../models/Ticket";

// Mirrors ticketCategory.routes.ts's callerHasPermission exactly (admin
// implicit-pass + live isActive check; agent/subadmin get a live DB-backed
// hasPermission check) — duplicated rather than imported since it's a
// 4-line helper and importing route-internal helpers across files adds
// more coupling than it saves. If you'd rather import it, export it from
// ticketCategory.routes.ts instead — pick one, be consistent.
async function callerHasPermission(req: Request, key: PermissionKey): Promise<boolean> {
  if (req.user!.role === "admin") return isActiveAccount(req.user!.id);
  return hasPermission(req.user!.id, key);
}

function toTicketDetailResponse(ticket: ITicket, customer: { id: string; name: string; email: string }) {
  return {
    id: ticket._id.toString(),
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    category: ticket.category,
    priority: ticket.priority,
    customer,
    assignedAgent: ticket.assignedAgent,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

// Staff-only — no customer path exists for ticket detail yet.
router.get(
  "/:id",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  async (req: Request, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const ticket = await Ticket.findById(req.params.id).populate<{
      customer: { _id: Types.ObjectId; name: string; email: string };
    }>("customer", "name email");
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.status(200).json(
      toTicketDetailResponse(ticket, {
        id: ticket.customer._id.toString(),
        name: ticket.customer.name,
        email: ticket.customer.email,
      })
    );
  }
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  async (req: Request<{ id: string }>, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    // Presence is checked against the RAW body, not the parsed result —
    // categoryFieldSchema's transform turns an absent key into `null`, same
    // as it does for POST /'s creation case, which would otherwise make
    // "field omitted" indistinguishable from "field explicitly cleared."
    const rawBody = (req.body ?? {}) as Record<string, unknown>;
    const parsed = updateTicketBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }
    const { category, priority } = parsed.data;

    if ("category" in rawBody && !(await callerHasPermission(req, "tickets:categorize"))) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    if ("priority" in rawBody && !(await callerHasPermission(req, "tickets:change_priority"))) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }

    if ("category" in rawBody) {
      if (category === null) {
        ticket.category = null;
      } else {
        const existing = await findByNameCaseInsensitive(category);
        if (!existing || !existing.active) {
          res.status(400).json({ error: "category does not match an active ticket category" });
          return;
        }
        ticket.category = existing.name; // canonical stored casing, not the caller's
      }
      console.info(`[tickets] ${req.params.id} category changed by ${req.user!.id} to ${ticket.category}`);
    }

    if ("priority" in rawBody) {
      ticket.priority = priority!;
      console.info(`[tickets] ${req.params.id} priority changed by ${req.user!.id} to ${priority}`);
    }

    await ticket.save();
    const populated = await ticket.populate<{ customer: { _id: Types.ObjectId; name: string; email: string } }>(
      "customer",
      "name email"
    );
    res.status(200).json(
      toTicketDetailResponse(populated, {
        id: populated.customer._id.toString(),
        name: populated.customer.name,
        email: populated.customer.email,
      })
    );
  }
);
```

`PermissionKey` is already imported at line 8 — no new import needed for it.

**Do not** add `requirePermission(...)` as route-level middleware on `PATCH /:id` — the required key depends on which fields are present in that specific request, exactly like `ticketCategory.routes.ts`'s `PATCH /:id`. `GET /:id` needs no per-field permission (any staff role can view), so `requireRole(...)` alone is enough there.

**Do not** use `validateBody(...)` on the `PATCH` route (see the comment above the handler) — call `.safeParse` inline so raw-body key presence stays available for the partial-update logic.

### 4 — No changes to `Ticket.ts`

`category`/`priority` fields and their types already have the correct shape (confirmed by reading the file). No schema/migration needed.

---

## Frontend Tasks

### 5 — Ticket-detail page (new)

**Create file:** `frontend/app/tickets/[id]/page.tsx`

Server Component, staff-only (mirrors `frontend/app/tickets/new/page.tsx`'s gating shape): cookie → access-token check → silent-refresh redirect → `peekJwtPayload` role check (`agent`/`admin`/`subadmin`, else redirect `/dashboard`) → `fetch(`${API_URL}/api/v1/tickets/${id}`)` → 401 refresh dance → 404 → not-found handling → render.

Layout: a simple two-column-on-desktop / stacked-on-mobile card — left/main: subject, description, customer name+email (read-only). Right/sidebar (matches the mockup): "TICKET" heading, **Status** as a read-only `Badge`, **Category** and **Priority** as `Select`s wired to the two server actions below (Client Component, colocated as `TicketDetailSidebar.tsx`).

### 6 — Server actions

**Create file:** `frontend/app/tickets/[id]/actions.ts`

Two actions, matching `frontend/app/admin/ticket-categories/actions.ts`'s shape (cookie read, 401-retry-once, `revalidatePath`):

- `updateTicketCategory(ticketId: string, category: string | null): Promise<{ error: string | null }>` → `PATCH /api/v1/tickets/:id` with `{ category }`.
- `updateTicketPriority(ticketId: string, priority: string): Promise<{ error: string | null }>` → `PATCH /api/v1/tickets/:id` with `{ priority }`.
- Import `listActiveTicketCategories` from `frontend/app/tickets/new/actions.ts` directly — it's already a plain exported async function from a `"use server"` file, fine to import elsewhere. Don't duplicate it.

### 7 — Sidebar component

**Create file:** `frontend/app/tickets/[id]/TicketDetailSidebar.tsx`

Client Component. Category `Select` — options from `listActiveTicketCategories()` plus the existing `UNSPECIFIED_CATEGORY` sentinel (`frontend/app/tickets/new/constants.ts`) — same UX, same underlying meaning: no category (maps to sending `category: null`). Priority `Select` — the fixed four options. Both save **immediately on change** (no separate submit button — matches the "edit one field inline" shape of `RenameCategoryDialog.tsx`), showing a brief inline success/error message. Disable each `Select` when the viewer's JWT `permissions` (via `peekJwtPayload`, passed down as a prop from the page) lacks the corresponding key (`tickets:categorize`/`tickets:change_priority`) and role isn't `admin` — reuse the exact `isViewerAdmin || viewerPermissions.includes(key)` boolean logic already used in `frontend/app/admin/ticket-categories/page.tsx`.

### 8 — i18n

**Files:** `frontend/messages/en.json`, `frontend/messages/ar.json`

New `TicketDetail` namespace: `heading` ("Ticket"), `subject`, `description`, `customer`, `status`, `category`, `priority`, `priorityLow/Medium/High/Urgent` (reuse the exact English/Arabic strings already in `NewTicket.priorityLow` etc. rather than retranslating), `categoryUnspecified` (reuse `NewTicket.categoryUnspecified`'s value), `statusNew/InProgress/Answered/Escalated/Closed` (labels for `Ticket.status`'s five values — read-only display only), `changeSaved`, `changeFailed`, `noAccess`, `notFound`. Add both files in the same change; key-set parity checked programmatically (`node -e` diff), same as every prior story.

---

## Edge Cases & Failure Modes

- **Invalid `:id` (malformed ObjectId)** — `404 { error: "Ticket not found" }` on both `GET` and `PATCH`, via `Types.ObjectId.isValid`, matching `ticket.routes.ts`'s existing idiom for `customerId` validation.
- **Ticket not found (valid ObjectId, no document)** — same 404.
- **Category not in Story 58's active list** — `400`, plain English message. An *inactive* category name is treated the same as unknown — matches Story 58's intent ("removes it from the picker for new assignments").
- **Category explicitly cleared (`null` or `""`)** — allowed; distinct from the key being absent entirely (meaning "don't touch category" — see Task 3's presence-detection note, the single most important correctness detail in this story).
- **Priority outside the fixed enum** — `400`, plain English message from the zod schema (`priority must be one of: low, medium, high, urgent`).
- **Both `category` and `priority` omitted (empty body / neither key present)** — currently just a no-op 200 (ticket re-saved unchanged, `updatedAt` still bumps since `.save()` runs regardless). Acceptable; not worth a dedicated rejection since no test or acceptance criterion asks for one — flag as a judgment call if a reviewer disagrees.
- **Caller lacks `tickets:categorize` but sends only `priority`** — succeeds; each field's permission is checked independently, only for the fields actually present.
- **Caller lacks `tickets:change_priority` but sends only `category`** — succeeds, same reasoning.
- **Customer calls either endpoint** — `403` via `requireRole("agent","admin","subadmin")` — no customer path exists for ticket detail yet.
- **Deactivated staff account** — `callerHasPermission`'s live `isActive`/`hasPermission` re-check applies, same as every other permission-gated route in this codebase; no new code needed for this.
- **Concurrent edits from two agents** — last write wins; no optimistic lock. `updatedAt` reflects the later save. Documented in a code comment, not solved.
- **Bilingual UI** — priority and status labels are translated; category names are admin-provided strings (Story 58) and render as-is in either locale, same as Story 57's form already does.

---

## Test Plan

1. **`backend/tests/constants/permissions.test.ts`** — extend with a `describe("tickets:categorize / tickets:change_priority (Story 9)")` block (mirroring the existing `tickets:categories_*` block): both keys in `PERMISSION_KEYS`, **not** in `SUBADMIN_ONLY_PERMISSIONS`, **are** in `DEFAULT_PERMISSIONS_BY_ROLE.agent`.
2. **`backend/tests/routes/ticket.routes.test.ts`** — new `describe("GET /api/v1/tickets/:id (Story 9)")`:
   - `401` without a token.
   - `403` for a customer.
   - `404` for a malformed id and for a well-formed-but-nonexistent id.
   - `200` for an agent, response includes populated `customer.name`/`customer.email`.
3. **`describe("PATCH /api/v1/tickets/:id (Story 9)")`:**
   - `200` setting category to an existing active category name (case-insensitive input); ticket's stored `category` matches the canonical stored name, not the caller's casing.
   - `200` setting category to `null` (clears it); `200` setting it to `""` (also clears it).
   - `400` for a category name not in the active list (both nonexistent and existing-but-inactive).
   - `200` for each of the four priority values; `400` for an invalid one.
   - `200` when both `category` and `priority` are sent together.
   - **Partial-update regression (the bug this plan specifically calls out):** sending only `priority` leaves an existing `category` untouched; sending only `category` leaves an existing `priority` untouched.
   - `403` when caller lacks `tickets:categorize` and sends `category` (even if they hold `tickets:change_priority`).
   - `403` when caller lacks `tickets:change_priority` and sends `priority`.
   - `403` for a customer or agent lacking both keys.
   - `404` for malformed/nonexistent id.
   - Admin implicit-pass (no explicit permission grant) succeeds for both fields.
   - Deactivated agent holding both keys still gets 403 (isActive re-check).
   - Regression: existing `POST /api/v1/tickets` tests (Story 8/57) still pass unchanged after `ALLOWED_PRIORITIES` moves to `ticket.schema.ts`.

---

## Verification Steps

1. **Backend builds:** `npm run build` in `backend/`.
2. **Backend tests:** `npm test` in `backend/` — all new + existing suites pass.
3. **Frontend builds:** `npm run build` in `frontend/` — new route `/tickets/[id]` appears; no missing-i18n-key warnings.
4. **Locale parity:** diff `TicketDetail` key sets between `en.json`/`ar.json`.
5. **Manual smoke:** sign in as the seeded agent (already holds both new keys by default), open a ticket's detail page, change category and priority independently, reload — both persist and neither clobbers the other. Sign in as an agent whose permissions were stripped via the staff-edit UI — the corresponding `Select` is disabled.
6. **Regression:** `/tickets/new`, `/admin/ticket-categories`, `/dashboard` still load and behave identically.

---

## Done Criteria

- [ ] `tickets:categorize` and `tickets:change_priority` added to `PERMISSION_KEYS` and `DEFAULT_PERMISSIONS_BY_ROLE.agent`; **not** added to `SUBADMIN_ONLY_PERMISSIONS`.
- [ ] `findByNameCaseInsensitive` exported from `ticketCategory.routes.ts` and reused (not reimplemented) in `ticket.routes.ts`.
- [ ] `ALLOWED_PRIORITIES` consolidated into `backend/src/validation/ticket.schema.ts` (exported), with `ticket.routes.ts` importing it rather than redefining it.
- [ ] `GET /api/v1/tickets/:id` exists (staff-only, populates customer name/email).
- [ ] `PATCH /api/v1/tickets/:id` exists as **one** endpoint, accepts optional `category`/`priority`, checks each field's permission independently based on the **raw request body's** key presence (not the zod-parsed/transformed result), validates category against Story 58's active list (storing the canonical name) and priority against the fixed enum, and persists via load + mutate + `.save()` (not `findByIdAndUpdate`).
- [ ] `frontend/app/tickets/[id]/page.tsx` exists — a real, reachable ticket-detail page (not stubbed/deferred), staff-gated, showing subject/description/customer/status (read-only) and editable Category/Priority selects that save immediately on change and respect the viewer's own permissions (disabled when lacking the relevant key).
- [ ] i18n keys added to both `en.json` and `ar.json` under `TicketDetail`, reusing `NewTicket`'s existing priority/category-unspecified strings rather than retranslating.
- [ ] Validation uses zod (`updateTicketBodySchema` in `ticket.schema.ts`), consistent with every other route in this backend; error responses stay plain English strings in the existing `{ error: string }` shape.
- [ ] All new backend tests pass, including the partial-update regression case (changing one field doesn't clobber the other); existing suite (207 tests as of the last recorded run) unaffected.

**STOP HERE. Report to the user and wait for confirmation before proceeding to the next story.**
