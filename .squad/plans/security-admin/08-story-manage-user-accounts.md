# Story 08 — Manage user accounts (Story: 45)

## Prerequisites

- Auth foundation: `requireAuth`/`requireRole` in `backend/src/middleware/auth.ts` (lines 19–49), `UserRole` in `backend/src/models/User.ts` (line 3), `req.user` typed in `backend/src/types/express.d.ts` (lines 5–14). Stories 1–3 (auth) assumed completed.
- customer-management Story 55 (`backend/src/routes/customer.routes.ts` `POST /`, lines 82–130) is the direct precedent for a staff-created account with `bcryptjs` hashing — this story mirrors that shape for agent/sub-admin accounts instead of customer accounts.
- `backend/scripts/seed-admin.ts` — the existing, already-implemented pattern for how `admin` accounts are actually provisioned: **directly in the database**, not through any HTTP endpoint. This story does not add a second way to create one.
- This is the **first** story in the `security-admin` feature folder — `.squad/plans/security-admin/00-overview.md` currently has no rows.
- `backend/src/app.ts` (lines 26–28) has a TODO listing `security-admin` among routers not yet mounted — this story removes it from that list.

---

## Story Goal

1. A full admin (`req.user.role === "admin"`) can create a new **agent** or **sub-admin** account with an initial password. **`admin` is never a valid role for this endpoint** — full admin accounts are provisioned directly in the database (see `backend/scripts/seed-admin.ts`), so there is no in-app path, not even for a full admin, that produces a new admin account.
2. A full admin can view a paginated roster of every staff account — **agent, admin, and sub-admin** — showing role, active status, and (for agents) online status. Admin rows appear here for visibility even though they were never created through this endpoint.
3. A full admin can deactivate any staff account. Deactivating an **agent or sub-admin** is the same action that creates them (see the permission shape below); deactivating an **existing admin account** is a separate, narrower action that always requires a full admin. Deactivation is enforced at next login and, going forward, on the account's next successful re-authentication; an already-issued JWT for that user remains valid until it naturally expires (documented tradeoff, not fixed here). A deactivated agent is also forced `isOnline: false` so ticket/chat auto-assignment (Stories 10/17) skips them immediately.
4. Extend the `role` enum from three values to four (`"customer" | "agent" | "admin" | "subadmin"`) — this is the foundational schema change the rest of the `security-admin` feature (Stories 46–48) builds on.

**Scope note:** this plan's own Backend/Frontend Tasks below only build create, roster, and deactivate — the three actions this story's acceptance criteria call for. The shipped product's account-management surface grew wider than that, as a natural extension of this same story's territory: viewing a single account's detail (`GET /api/v1/admin/users/:id`), editing its name/email/role (`PATCH /:id`), reactivating it (`PATCH /:id/activate`, alongside the `PATCH /:id/deactivate` this plan does build), and soft-deleting it (`DELETE /:id`, backed by a new `isDeleted` flag on `User` — a deleted account is hidden from the roster and fully locked out, but the document is kept for referential integrity). This plan is left describing only its original three actions rather than being rewritten to also spec the extra endpoints/pages, but note it for anyone reconciling this doc against the real `admin.routes.ts`. What genuinely *is* Story 46's own contribution layered on top of this wider surface is the granular `staff:*` permission gating itself (including the `staff:view_account`/`staff:delete` keys for the two newer actions), the per-account `permissions` field, the subadmin-only restriction, and the permissions-editing step embedded in the account creation/edit flow — see `09-story-configure-roles-and-permissions.md`.

**Access shape:** this story's three actions are conceptually gated by a family of granular `staff:*` permissions, not one shared key — delegable to a sub-admin once Story 46 builds the permission layer (`admin` always passes): viewing the roster maps to `staff:view_list`, creating an account maps to `staff:edit` (the same key that, once the wider surface described in the Scope note above exists, also covers editing an account's name/email/role), and deactivating an account maps to `staff:toggle_status`. All three (plus the `staff:view_account`/`staff:delete` keys for the actions outside this story's own scope) are part of the subadmin-only permission set (see `.squad/plans/security-admin/00-overview.md`) — never assignable to an agent account. There is **no cap needed on creation** — since `admin` is never a creatable role here, a delegated sub-admin holding `staff:edit` can never mint an account more powerful than their own. The cap instead applies to **toggling the status of an existing admin account**: that always requires a true admin, regardless of `staff:toggle_status`, so a delegated sub-admin cannot disable a higher-privileged account. **Story 46's permission model and `requirePermission` middleware don't exist yet when this story executes** (it's Story 46, the very next one) — so every endpoint here is gated with plain `requireRole("admin")` for now, with inline comments marking exactly where Story 46 must convert each action to its matching `requirePermission("staff:...")` key, and marking the one branch (deactivating an `admin` target) that must **stay** `requireRole("admin")` permanently and never be converted.

Out of scope: creating an `admin` account through the app in any form (see above — this is a hard boundary, not just an unbuilt feature), assigning/editing sub-admin permissions (Story 46), reactivating a deactivated account (not in the acceptance criteria), a token blocklist / full session-invalidation infra (documented tradeoff below instead), self-deactivation or last-admin-deactivation guardrails (flagged in Edge Cases, not built — no acceptance criterion asks for it).

**Note on the permission key's name:** the granular permission this story's actions are gated by (once Story 46 exists) is named `staff:toggle_status`, not `staff:deactivate` — the broader name anticipates a later two-way activate/deactivate action even though this story itself only builds one-way deactivation. Reactivation is still not built here; the key name is simply chosen up front so Story 46 (and any later story that adds reactivation) doesn't need to introduce a second permission key or rename this one.

---

## Context — Read These Files First

1. `backend/src/models/User.ts` — full file (89 lines). `UserRole` type (line 3), schema `role` enum (line 68). Both need the fourth value added.
2. `backend/src/middleware/auth.ts` — full file (49 lines). `requireAuth` attaches `req.user = { id, role, name }` (line 30); `requireRole(...allowedRoles)` 403s with `{ error: "You do not have permission to perform this action" }` (line 44).
3. `backend/src/middleware/README.md` — full file (41 lines). Line 17 (`"customer" | "agent" | "admin"`, "no finer-grained permission system yet; that's Story 45") and line 40 (`"see Story 45"`) are both stale — Story 45 is *this* story (account management), Story 46 is the permission layer. Both references need to point at Story 46 and the role list needs `subadmin`.
4. `backend/scripts/seed-admin.ts` — full file. This is the *only* place `role: "admin"` is ever set anywhere in the codebase today — confirms admin accounts are already a DB-provisioning concern, not an API one, so this story isn't inventing that boundary, just formalizing it for the new `agent`/`subadmin` creation path.
5. `backend/src/routes/customer.routes.ts` — full file (260 lines). Reuse patterns: `BCRYPT_SALT_ROUNDS = 10`, `MIN_PASSWORD_LENGTH = 8` (lines 10–11), the `POST /` staff-account-creation handler (lines 82–130: validation → normalize email → duplicate check → `bcrypt.hash` → `User.create` with a 11000-duplicate catch → 201 with a serialized response), and the paginated roster `GET /` (lines 40–68: `page`/`limit` query parsing, `Promise.all([find, countDocuments])`, response shape `{ <items>, total, page, limit }`).
6. `backend/src/routes/auth.routes.ts` — lines 1–27 and 46–105. `signToken`/hashing precedent; not directly reused here (this story doesn't issue tokens), but matches the same `bcryptjs` + `BCRYPT_SALT_ROUNDS`/`MIN_PASSWORD_LENGTH` constants pattern.
7. `backend/src/app.ts` — full file (37 lines). Router-mount pattern (lines 5–10, 20–25); this story adds an `adminRoutes` import and an `app.use("/api/v1/admin/users", adminRoutes)` line, and removes `security-admin` from the TODO comment (lines 26–28).
8. `frontend/app/customers/page.tsx` — full file (224 lines). Roster-table precedent: `StaffSidebar` usage (lines 73–99), mobile-card / desktop-table split (lines 112–194), Previous/Next pagination (lines 196–220), 401→refresh-redirect and 403→"no access" handling (lines 51–85).
9. `frontend/app/customers/new/page.tsx` (46 lines), `NewCustomerForm.tsx` (115 lines), `actions.ts` (84 lines) — account-creation precedent: Server Component role gate via `peekJwtPayload` (page.tsx lines 36–39), controlled-input Client Component with `useActionState` (`NewCustomerForm.tsx` lines 16–24), Server Action with a `zod` schema, token-refresh-and-retry-once (`actions.ts` lines 48–74), redirect on success.
10. `frontend/components/StaffSidebar.tsx` — full file (65 lines). `NAV_ITEMS` array (line 15) currently has one static entry; this story adds a role-gated `"accounts"` entry (visible only when the viewer is `admin`), which means `StaffSidebar` needs to read the viewer's role itself (it already reads cookies for the collapse-state preference at lines 20–25, so this follows the same self-contained pattern rather than a new prop).
11. `frontend/components/SiteHeader.tsx` — full file (65 lines). `isStaff` (line 25) is `role === "agent" || role === "admin"` — **not modified by this story** (see Edge Cases: `subadmin` isn't yet reflected here, deliberately deferred to Story 46, which is the story that generally extends "is staff" checks for the new role).
12. `frontend/messages/en.json` — lines 1–124. `Nav`, `StaffSidebar`, `CustomersList`, `NewCustomer` sections are the key-naming precedent for this story's new `AdminUsersList` / `NewStaffAccount` sections.
13. `frontend/lib/jwt.ts` — full file (17 lines). `peekJwtPayload(token)` — UI-only role peek, used the same way `customers/new/page.tsx` uses it.
14. `frontend/components/ui/select.tsx` exists (already installed per `CLAUDE.md` "Design system"); `frontend/components/ui/alert-dialog.tsx` does **not** exist — Task 10 below adds it via `npx shadcn@latest add alert-dialog` for the deactivate-confirmation dialog.

---

## Product rules (from story)

- **New behaviour, no prior version exists** — this is the first story to touch account management for agent/admin/subadmin roles.
- Role enum grows from `"customer" | "agent" | "admin"` to `"customer" | "agent" | "admin" | "subadmin"`.
- `POST /api/v1/admin/users` (create): body `{ name, email, password, role }` where `role` is `"agent" | "subadmin"` **only** — never `"customer"` (that's `POST /register` or `POST /api/v1/customers`) and never `"admin"` (DB-provisioned only, see Prerequisites).
- `GET /api/v1/admin/users` (roster): staff accounts (`role` in `["agent","admin","subadmin"]`), paginated, never includes `passwordHash`.
- `PATCH /api/v1/admin/users/:id/deactivate`: sets `isActive: false`; if the target's `role === "agent"`, also sets `isOnline: false`. No special-cased behavior difference for an `admin` target's *fields* — the difference is purely in who's allowed to call it (see below).
- All three endpoints: `requireAuth`, `requireRole("admin")` for now (see Story Goal). Once Story 46 exists: `GET` converts to `requirePermission("staff:view_list")`, `POST` converts to `requirePermission("staff:edit")`, and the `PATCH` branch targeting `agent`/`subadmin` converts to `requirePermission("staff:toggle_status")`; the `PATCH` branch targeting an existing `admin` account stays `requireRole("admin")` **permanently** — never converted, never delegable.

---

## Backend Tasks

### 1 — Extend `UserRole` to four values

**File: `backend/src/models/User.ts`**

Line 3:

```ts
export type UserRole = "customer" | "agent" | "admin" | "subadmin";
```

Line 68 (schema enum):

```ts
role: { type: String, enum: ["customer", "agent", "admin", "subadmin"], required: true },
```

No other field changes — `isActive`, `isOnline` already exist and are reused as-is.

### 2 — Create the admin-users router

**Create file: `backend/src/routes/admin.routes.ts`**

Follow the shape of `backend/src/routes/customer.routes.ts` (imports, `express.Router()`, shared constants). Structure:

```ts
import express, { Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole } from "../middleware/auth";
import { User, IUser, UserRole } from "../models/User";

const router = express.Router();

const BCRYPT_SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

// Valid roster/deactivation TARGETS — includes "admin" because admin
// accounts exist (DB-provisioned, see backend/scripts/seed-admin.ts) and
// must be visible/deactivatable here, even though they can't be CREATED
// through this router.
const STAFF_ROLES: UserRole[] = ["agent", "admin", "subadmin"];

// Valid roles this router can CREATE. Deliberately excludes "admin" — see
// Story Goal: admin accounts are never created through the app.
const CREATABLE_STAFF_ROLES: UserRole[] = ["agent", "subadmin"];

function toStaffAccountResponse(user: IUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    isOnline: user.isOnline,
    createdAt: user.createdAt,
  };
}

// ...GET /, POST /, PATCH /:id/deactivate handlers below
export default router;
```

### 3 — `GET /` (staff account roster)

```ts
// TODO (security-admin Story 46): convert to requirePermission("staff:view_list")
// once that middleware exists — a sub-admin delegated agent/sub-admin account
// management needs to see the roster to act on it. requireRole("admin") for
// now since requirePermission doesn't exist yet.
router.get("/", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const filter = { role: { $in: STAFF_ROLES } };

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("name email role isActive isOnline createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    users: users.map(toStaffAccountResponse),
    total,
    page,
    limit,
  });
});
```

Matches the pagination shape of `customer.routes.ts` lines 40–68 exactly (same `page`/`limit`/`total` response envelope) — the frontend roster table (Task 8) reuses the same Previous/Next pattern as `customers/page.tsx`.

### 4 — `POST /` (create an agent or sub-admin account)

```ts
interface CreateStaffAccountBody {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
}

router.post(
  "/",
  requireAuth,
  // TODO (security-admin Story 46): convert to requirePermission("staff:edit")
  // once that middleware exists. No admin-target cap needed on this route —
  // CREATABLE_STAFF_ROLES already excludes "admin" entirely, so there is
  // nothing here for a delegated sub-admin to escalate into.
  requireRole("admin"),
  async (req: Request<unknown, unknown, CreateStaffAccountBody>, res: Response) => {
    const { name, email, password, role } = req.body ?? {};

    if (!name || !email || !password || !role) {
      res.status(400).json({ error: "name, email, password, and role are required" });
      return;
    }
    if (!CREATABLE_STAFF_ROLES.includes(role as UserRole)) {
      res.status(400).json({ error: "role must be one of: agent, subadmin" });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    let user;
    try {
      user = await User.create({
        name,
        email: normalizedEmail,
        passwordHash,
        role: role as UserRole,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }
      throw err;
    }

    res.status(201).json(toStaffAccountResponse(user));
  }
);
```

Mirrors `customer.routes.ts` lines 82–130 exactly except: `role` is a required body field validated against `CREATABLE_STAFF_ROLES` (instead of hardcoded `"customer"`), and no `phone` field (not in this story's acceptance criteria).

### 5 — `PATCH /:id/deactivate`

```ts
router.patch(
  "/:id/deactivate",
  requireAuth,
  // requireRole("admin") gates every caller today because requirePermission
  // doesn't exist yet (Story 46). Once it does:
  //   - target.role === "agent" | "subadmin" → requirePermission("staff:toggle_status")
  //   - target.role === "admin"              → requireRole("admin"), PERMANENTLY
  // The second branch is a hard cap, not a placeholder — do not convert it
  // even after Story 46 lands. Since the target role isn't known until the
  // handler loads the document, this split happens INSIDE the handler (see
  // the check below), not in the middleware chain.
  requireRole("admin"),
  async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    const user = await User.findById(req.params.id);
    if (!user || !STAFF_ROLES.includes(user.role)) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    // TODO (security-admin Story 46): once requirePermission exists, the
    // requireRole("admin") above is replaced by requirePermission("staff:toggle_status")
    // for the agent/subadmin case, and THIS check becomes the only thing
    // standing between a delegated sub-admin and deactivating a
    // higher-privileged admin account:
    //   if (user.role === "admin" && req.user!.role !== "admin") {
    //     res.status(403).json({ error: "You do not have permission to perform this action" });
    //     return;
    //   }
    // Not reachable today (the middleware above already restricts every
    // caller to a true admin), but the comment marks exactly where Story 46
    // must add it — do not lose this branch when converting the middleware.

    user.isActive = false;
    if (user.role === "agent") {
      user.isOnline = false;
    }
    await user.save();

    res.status(200).json(toStaffAccountResponse(user));
  }
);
```

`!STAFF_ROLES.includes(user.role)` returning 404 (not 400/403) for a `customer` target id is deliberate — this endpoint's URL space is scoped to staff accounts only; a customer id here should look indistinguishable from a nonexistent id, same discipline as `customer.routes.ts`'s own 404-on-miss pattern.

### 6 — Mount the router

**File: `backend/src/app.ts`**

- Add `import adminRoutes from "./routes/admin.routes";` alongside the existing route imports (after line 10, `meRoutes`).
- Insert `app.use("/api/v1/admin/users", adminRoutes);` after the `/api/v1/me` line (current line 25).
- Remove `security-admin` from the TODO comment on lines 26–28 (leave `agent-workspace, sla-automation, knowledge-base, ai-features, reports-management` intact).

### 7 — Update `backend/src/middleware/README.md`

- Line 17: replace

  ```
  `"customer" | "agent" | "admin"` — see `backend/src/models/User.ts:3`. There is no finer-grained permission system yet; that's Story 45 (`security-admin` feature).
  ```

  with:

  ```
  `"customer" | "agent" | "admin" | "subadmin"` — see `backend/src/models/User.ts:3`. `admin` is the full/main admin, always has every permission, and is only ever provisioned directly in the database (`backend/scripts/seed-admin.ts`) — there is no API that creates one. `subadmin` is a delegated staff tier, created through the app, whose specific permissions are configured in Story 46 (`security-admin` feature) — there is no finer-grained permission system yet for it.
  ```

- Line 40: replace `see Story 45 (\`security-admin\` feature) — not built yet.` with `see Story 46 (\`security-admin\` feature) — not built yet.`

---

## Frontend Tasks

### 8 — Staff-account roster page

**Create file: `frontend/app/admin/users/page.tsx`** (Server Component)

Mirror `frontend/app/customers/page.tsx` structure exactly (imports, `generateMetadata` with `robots: { index: false, follow: false }` per `CLAUDE.md` "SEO" — authenticated/internal page):

- `searchParams: Promise<{ page?: string; _refreshed?: string }>`, same `page` parsing (line 44 precedent).
- Session read: `cookies()` → `SESSION_COOKIE`/`REFRESH_COOKIE`, same 401→`/api/session/refresh?next=/admin/users...`→retry-once pattern as `customers/page.tsx` lines 47–68.
- Fetch `GET ${API_URL}/api/v1/admin/users?page=${page}&limit=20` with the bearer token.
- On 403 (a signed-in non-admin, e.g. an agent or subadmin without access): redirect to `/dashboard` — this page, like every other staff page whose access a viewer's role/permissions don't cover (`/admin/users`, `/admin/users/[id]/edit`, `/admin/users/new`, `/customers`), redirects rather than rendering a "you don't have access" message. (Within this story, before Story 46's permission layer exists, the only caller who can ever reach this page at all is a true admin — `requireRole("admin")` gates the endpoint outright — so the redirect is effectively unreachable until Story 46 makes access delegable via `staff:view_list`; it is documented here so Story 46 doesn't have to reinvent the pattern.)
- Table columns: Name, Email, Role (badge — reuse `Badge` component, one variant per role, including `admin` rows even though they can't be created here), Status (Active/Inactive, same `success`/`secondary` badge pattern as `customers/page.tsx` lines 172–178), Online (only meaningful for `agent` rows — render `—` for `admin`/`subadmin`), Joined, and an Actions column. In this story (before Story 46's granular permissions exist), the only action is Deactivate (Task 10), rendered for every row including `admin` — the backend enforces who's actually allowed to use it (see Task 5's Story-46 note), the frontend does not pre-filter it out. **Once Story 46 lands**, this column's icons are shown individually per viewer permission (edit/toggle-status/delete gated respectively by `staff:edit`/`staff:toggle_status`/`staff:delete`), and the whole Actions column is omitted for a viewer holding none of the three, rather than rendered empty — see Story 46's plan for the follow-on change.
- Same mobile-card / desktop-table split as `customers/page.tsx` (lines 112–194) and the same Previous/Next pagination (lines 196–220).
- Add a `"New account"` button (`Button asChild` → `Link href="/admin/users/new"`), same placement as `customers/page.tsx` line 103's `"Add customer"` button.

### 9 — Staff-account creation page

**Create files:**
- `frontend/app/admin/users/new/page.tsx` (Server Component) — mirrors `frontend/app/customers/new/page.tsx` exactly: session check, `peekJwtPayload` role gate (`role !== "admin"` → `redirect("/dashboard")`, matching the redirect-to-dashboard pattern used across every staff page a viewer's role/permissions don't cover, rather than bouncing back to the roster; narrower than the customer-creation page's `agent`-or-`admin` gate since only full admin reaches this UI at all).
- `frontend/app/admin/users/new/NewStaffAccountForm.tsx` (Client Component) — mirrors `NewCustomerForm.tsx` structure (`useActionState`, controlled inputs for `name`/`email`/`password`) plus a **role** field using the already-installed `Select` (`frontend/components/ui/select.tsx`) with **two** options only: Agent / Sub-admin. No `phone` field (not part of this story), no `Admin` option anywhere in this form — there is no way to reach an admin-creation flow from this UI at all.
- `frontend/app/admin/users/new/actions.ts` (Server Action) — mirrors `frontend/app/customers/new/actions.ts`: `zod` schema `{ name, email, password, role: z.enum(["agent","subadmin"]) }`, token-refresh-and-retry-once (`actions.ts` lines 48–74 pattern), `POST /api/v1/admin/users`, `redirect("/admin/users")` on success, surface the backend's 409 (`emailInUse`) and 400 (`role` invalid — shouldn't happen client-side since the `Select` only offers valid values, but map it to a generic error) distinctly.

### 10 — Deactivate action + confirmation dialog

**Run first:** `npx shadcn@latest add alert-dialog` from `frontend/` (not yet installed — confirmed absent from `frontend/components/ui/`).

**Create file: `frontend/app/admin/users/actions.ts`** — one Server Action `deactivateStaffAccount(userId: string)`, same cookie/refresh-and-retry-once pattern as Task 9's `actions.ts`, calling `PATCH /api/v1/admin/users/${userId}/deactivate`, then `revalidatePath("/admin/users")` (no redirect — stays on the roster page). Surface the backend's 403 distinctly (e.g. `t("cannotDeactivateAdmin")`) for the case a non-full-admin caller somehow reaches this action against an `admin` target — not reachable today since the whole router is `requireRole("admin")`, but keep the error path honest rather than assuming it can't happen once Story 46 changes the gating.

**Create file: `frontend/app/admin/users/DeactivateButton.tsx`** (Client Component) — wraps the newly-installed `AlertDialog` (trigger = a small destructive-variant `Button`, e.g. `<Ban />` icon from `lucide-react`) around a confirmation, and calls `deactivateStaffAccount` in the `AlertDialogAction`'s `onClick` via `useTransition`. Render one `DeactivateButton` per active row in Task 8's table (including `admin` rows); render nothing (or a disabled/muted state) for rows already `isActive: false`.

### 11 — Staff sidebar: admin-only "Accounts" entry

**File: `frontend/components/StaffSidebar.tsx`**

- `NAV_ITEMS` (line 15) becomes role-aware. Add a second entry:

  ```ts
  const NAV_ITEMS = [
    { key: "customers", href: "/customers", icon: Users },
    { key: "accounts", href: "/admin/users", icon: ShieldUser, adminOnly: true },
  ] as const;
  ```

  (`ShieldUser` or an equivalent role/shield icon from `lucide-react` — confirm the exact export name exists in the installed `lucide-react` version before use; fall back to `Shield` if not.)
- The component needs the viewer's role to filter `adminOnly` items. It's already an async Server Component reading `cookies()` for the collapse-state preference (lines 20–25) — add the same `SESSION_COOKIE` read + `peekJwtPayload` used elsewhere (`frontend/lib/jwt.ts`, `customers/new/page.tsx` line 36 precedent), then `const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");` and map over `visibleItems` instead of `NAV_ITEMS` at line 42.
- Update the header comment (lines 9–14) — it already anticipates "security-admin's account management" landing here; no change needed to the comment's substance, just note (inline, brief) that it's admin-gated, not staff-wide like the `customers` entry.

### 12 — i18n

**File: `frontend/messages/en.json`**

Add two new sections (after `NewCustomer`, matching key-naming precedent from lines 89–124). Note: `AdminUsersList.noAccess` below is superseded by the redirect-to-`/dashboard` pattern (see Task 8) — the shipped page never actually renders this string, but the key is kept for translation completeness / in case a future story reintroduces an inline no-access state.

```json
"AdminUsersList": {
  "heading": "Staff accounts",
  "addAccount": "New account",
  "colName": "Name",
  "colEmail": "Email",
  "colRole": "Role",
  "colStatus": "Status",
  "colOnline": "Online",
  "colJoined": "Joined",
  "roleAgent": "Agent",
  "roleAdmin": "Admin",
  "roleSubadmin": "Sub-admin",
  "statusActive": "Active",
  "statusInactive": "Inactive",
  "onlineYes": "Online",
  "onlineNo": "Offline",
  "onlineNotApplicable": "—",
  "deactivate": "Deactivate",
  "deactivateConfirmTitle": "Deactivate this account?",
  "deactivateConfirmBody": "They will lose access once their current session expires. This cannot be undone from here.",
  "deactivateConfirmAction": "Deactivate",
  "deactivateCancel": "Cancel",
  "deactivateFailed": "Could not deactivate this account.",
  "cannotDeactivateAdmin": "Only a full admin can deactivate another admin account.",
  "empty": "No staff accounts yet.",
  "noAccess": "You don't have access to this page.",
  "previous": "Previous",
  "next": "Next",
  "pageOf": "Page {page} of {totalPages}"
},
"NewStaffAccount": {
  "heading": "New staff account",
  "subheading": "Create an agent or sub-admin account.",
  "name": "Name",
  "email": "Email",
  "role": "Role",
  "roleAgent": "Agent",
  "roleSubadmin": "Sub-admin",
  "initialPassword": "Initial password",
  "passwordHint": "Share this with them directly — they can change it later.",
  "submit": "Create account",
  "submitPending": "Creating account…",
  "genericError": "Could not create this account.",
  "notSignedIn": "You're not signed in.",
  "emailInUse": "An account with this email already exists.",
  "nameRequired": "Name is required.",
  "invalidEmail": "Enter a valid email address.",
  "passwordTooShort": "Password must be at least 8 characters."
}
```

Note `AdminUsersList` keeps `roleAdmin` (the roster displays existing admin rows) but `NewStaffAccount` has **no** `roleAdmin` key at all — the creation form never needs to render that option.

Also add the `"accounts": "Accounts"` key to the existing `"Nav"` section (line 2–7) — used by `StaffSidebar`'s `t(item.key)` calls (`frontend/components/StaffSidebar.tsx` line 48/58).

**File: `frontend/messages/ar.json`** — add the matching Arabic translations for both new sections and the `Nav.accounts` key, per `CLAUDE.md`'s "When adding a new key to `en.json`, add the matching key to `ar.json` in the same change."

---

## Edge Cases & Failure Modes

- **Non-admin (agent, subadmin, or customer) calls any `/api/v1/admin/users*` endpoint** → 403 via `requireRole("admin")`, exact body `{ error: "You do not have permission to perform this action" }` (`auth.ts` line 44). Includes a `subadmin` caller even after Story 46 exists, unless they hold the matching `staff:*` key for that action (`staff:view_list`, `staff:edit`, or `staff:toggle_status`) — but that conversion isn't built in this story, so today a `subadmin` gets a flat 403 regardless of any future-granted permission.
- **Creating an account with `role: "customer"` or `role: "admin"`** → 400 (`CREATABLE_STAFF_ROLES` rejects both) — customer accounts go through `POST /register` or `POST /api/v1/customers`; admin accounts are DB-provisioned only and have no API path at all, full stop.
- **Duplicate email on creation** → 409, same `E11000` → `{ error: "An account with this email already exists" }` translation as `customer.routes.ts` lines 120–125.
- **`PATCH /:id/deactivate` on a customer id** → 404 (`STAFF_ROLES.includes(user.role)` check), not 400/403 — indistinguishable from a nonexistent id, matching `customer.routes.ts`'s existing not-found discipline.
- **`PATCH /:id/deactivate` on an already-inactive account** → idempotent 200, no special-cased error; `isActive` stays `false`, `isOnline` (if agent) stays `false`.
- **`PATCH /:id/deactivate` targeting an existing `admin` account** → succeeds today (200) because the whole router is `requireRole("admin")`, so only a true admin can reach it anyway — the target-role split described in Task 5's comment has nothing to enforce yet. This becomes a real, load-bearing check the moment Story 46 converts the agent/subadmin branch to `requirePermission("staff:toggle_status")`; **do not let that conversion silently drop the admin-target branch** — it's the only thing preventing a delegated sub-admin from disabling a higher-privileged account once that conversion lands.
- **Deactivating an agent** → `isOnline` forced to `false` alongside `isActive`, so Stories 10/17's `isOnline: true` auto-assignment queries exclude them immediately, not just at their next login.
- **Deactivated user's existing JWT** — remains cryptographically valid until its ~15-minute expiry; `requireAuth` only checks signature/expiry, not `isActive` (no DB hit). Documented tradeoff, same reasoning as customer-management's deactivation precedent — not fixed here; a currently-logged-in deactivated user keeps working elsewhere in the app for up to the token's remaining lifetime, but cannot obtain a *new* token via `/login` (already enforced by the existing `!user.isActive` check in `auth.routes.ts` line 122) or, once Story 46 exists, pass any *new* permission-gated check that does a fresh DB lookup.
- **Admin deactivates their own account, or deactivates the last remaining active admin** — no special-case guard is built here (not in this story's acceptance criteria); flagged as a known risk, not mitigated. A locked-out state would require direct DB access to recover (`isActive: true` on at least one admin document) — the same DB-level access already required to create an admin account in the first place, so this isn't introducing a new class of "needs DB access to fix" risk.
- **`subadmin` role value reaching frontend role checks that don't yet know about it** — `frontend/components/SiteHeader.tsx` line 25's `isStaff` check (`role === "agent" || role === "admin"`) is deliberately **not** updated by this story, so a `subadmin` signed in today sees the signed-out-style nav (no "Customers" link, no avatar-menu staff affordances) until Story 46 extends that check. This is a real, visible gap for the lifetime between this story and Story 46 landing — acceptable because no `subadmin` accounts can meaningfully do anything yet anyway (Story 46 is what gives them any permissions at all).
- **Unicode / RTL names in staff accounts** — allowed unchanged, same as `customer.routes.ts`'s existing precedent; no normalization.

---

## Test Plan

Project test runner is **Vitest** (`backend/vitest.config.ts`, tests under `backend/tests/`, run via `npm test` — see `CLAUDE.md` "Testing"). Add:

**Create file: `backend/tests/routes/admin.routes.test.ts`**

1. **Unit — auth gate:** `GET /api/v1/admin/users` without `Authorization` → 401.
2. **Unit — role gate:** `GET /api/v1/admin/users` as a `customer` or `agent` token → 403 with the exact `requireRole` error body.
3. **Integration — roster:** seed one of each `agent`/`admin`/`subadmin`/`customer`; `GET /api/v1/admin/users` as admin → 200, response `users` contains exactly the three staff accounts (including the `admin` one, not the customer), no `passwordHash` field present.
4. **Integration — create agent/subadmin:** `POST /api/v1/admin/users` as admin with each of the two valid roles → 201, DB reflects `role`, `passwordHash` set via bcrypt (verify with `bcrypt.compare`).
5. **Integration — create with `role: "customer"`:** → 400.
6. **Integration — create with `role: "admin"`:** → 400, same `CREATABLE_STAFF_ROLES` rejection as `"customer"` — proves there is no way to mint an admin through this endpoint even as a true admin caller.
7. **Integration — create with missing/short password:** → 400.
8. **Integration — create with duplicate email:** → 409.
9. **Integration — deactivate agent:** seed an active, online agent; `PATCH /api/v1/admin/users/:id/deactivate` as admin → 200; re-fetch from DB confirms `isActive === false` and `isOnline === false`.
10. **Integration — deactivate admin/subadmin (non-agent):** confirms `isActive === false`, `isOnline` untouched (schema default `false` already, but assert it wasn't explicitly flipped for a non-agent to catch an over-broad implementation).
11. **Integration — deactivate a customer id:** → 404.
12. **Integration — deactivate a nonexistent id:** → 404 (same response as case 11 — proves no user-enumeration signal).
13. **Integration — non-admin (agent) attempts create/deactivate:** → 403 for both.

`cd backend && npm run typecheck` must pass with no new `any` in `admin.routes.ts` or the `User.ts` role-type change.

**Frontend:** no automated test runner exists yet (per `CLAUDE.md` "Testing") — verify manually per Verification Steps below.

---

## Migration / Rollback

- **Schema change:** `role` enum grows from 3 to 4 values (`backend/src/models/User.ts` lines 3 and 68). This is additive — existing documents with `role` in `{"customer","agent","admin"}` remain valid against the new enum; no data migration needed. No document currently has `role: "subadmin"` (didn't exist before this story), so there's nothing to backfill.
- **Rollback:** revert `User.ts`'s two lines, delete `backend/src/routes/admin.routes.ts`, revert the `app.ts` mount + TODO-comment change, revert `middleware/README.md`. Any `subadmin` accounts created in the meantime would fail schema validation on next save after rollback — acceptable for a plan-stage rollback (no such accounts exist until this story ships and someone uses it).
- Frontend rollback: delete `frontend/app/admin/users/`, revert `StaffSidebar.tsx` and the two `messages/*.json` files.

---

## Verification Steps

1. **Backend typechecks:** in `backend/`, run `npm run typecheck` — exit 0.
2. **Backend tests:** `npm test` — all cases in Test Plan pass.
3. **Backend builds:** `npm run build` — clean `tsc` build.
4. **Backend boots:** `npm run dev`; `curl -i http://localhost:<port>/api/v1/health` still 200.
5. **Route smoke:** with a hand-issued admin JWT, `POST /api/v1/admin/users` with `{ name, email, password, role: "subadmin" }` → 201; the same call with `role: "admin"` → 400; `GET /api/v1/admin/users` → the new account appears; `PATCH /api/v1/admin/users/<id>/deactivate` → 200 with `isActive: false`.
6. **Frontend builds:** in `frontend/`, run `npm run build` — no type errors.
7. **Frontend manual smoke:** `npm run dev`, sign in as an admin, navigate to `/admin/users` — roster renders including any DB-seeded admin account; "New account" only offers Agent/Sub-admin and successfully creates one, redirecting back to the roster; the Deactivate button's confirmation dialog appears and, on confirm, the row updates to Inactive without a full page reload. Sign in as an agent and confirm `/admin/users` redirects to `/dashboard` (not a rendered "no access" message) and the sidebar has no "Accounts" entry.
8. **Regression:** `/customers` roster and `/customers/new` continue to work unchanged; existing `requireRole` behavior on `ticket.routes.ts`/`conversation.routes.ts` is untouched.

---

## Done Criteria

- [x] `UserRole` includes `"subadmin"` in both the TypeScript type and the Mongoose schema enum (`backend/src/models/User.ts`).
- [x] `POST /api/v1/admin/users` creates an agent or sub-admin account with a hashed password; rejects `role: "customer"`, rejects `role: "admin"`, and rejects duplicate emails.
- [x] `GET /api/v1/admin/users` returns a paginated roster of all staff accounts (agent, admin, subadmin), never including `passwordHash`.
- [x] `PATCH /api/v1/admin/users/:id/deactivate` sets `isActive: false`, and additionally `isOnline: false` when the target is an `agent`. **Superseded, further along than originally scoped:** the admin-target cap isn't just a marked TODO comment — `canManageTarget()` in `admin.routes.ts` actually enforces it (acting on an existing `admin` account always requires a true admin, never delegable via any permission), covering activate/deactivate/edit/delete alike.
- [x] **Superseded, further along than originally scoped:** rather than staying `requireRole("admin")` with TODO markers for a future conversion, all endpoints were converted straight to granular `requirePermission`/`canManageTarget` checks against the `staff:*` keys (`GET /` → `staff:view_list`, `GET /:id` → `staff:view_account`, `POST /` → `staff:edit`, `PATCH /:id` → `staff:edit`/`staff:permissions` depending on which fields are being changed, `PATCH /:id/activate`+`/deactivate` → `staff:toggle_status`, `DELETE /:id` → `staff:delete`) — see security-admin Story 46's plan for the full key list. The admin-target branch stays the one non-convertible, non-delegable check, exactly as scoped.
- [x] `backend/src/middleware/README.md` lists all four roles, notes that `admin` is DB-provisioned only, and documents the finished per-individual-account permission system (not just a forward pointer to a future story).
- [x] `frontend/app/admin/users` (roster + new-account pages) exists, following the `customers`/`customers/new` precedent for session handling and controlled forms; the new-account role selector offers only Agent/Sub-admin. **Superseded:** reachable by a true admin or a sub-admin delegated `staff:edit`, not admin-only — matching the granular permission model.
- [x] **Superseded:** `StaffSidebar`/`MobileStaffNav` show "Accounts" to `role === "admin"` OR `role === "subadmin"` (per `lib/staffNav.ts`) — a sub-admin needs the nav entry to reach the page even before whether they hold `staff:view_list` is known; the page itself 403s→redirects a subadmin without it.
- [x] `frontend/messages/en.json` and `frontend/messages/ar.json` both have matching `AdminUsersList`/`NewStaffAccount` sections and the `Nav.accounts` key.
- [x] `npm run typecheck` + `npm test` (backend, 135 passing) and `npm run build` (frontend) all pass clean.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 09 (configure-roles-and-permissions).**
