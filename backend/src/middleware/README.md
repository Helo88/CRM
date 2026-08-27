# Auth middleware — RBAC convention

## `requireAuth`

Verifies the `Authorization: Bearer <jwt>` header against `JWT_SECRET`. On success, attaches `req.user = { id, role }` (decoded from the JWT's `{ sub, role }` payload) and calls `next()`. On any failure — missing header, malformed token, expired token, wrong signature — responds `401` and does not call `next()`.

See `backend/src/middleware/auth.ts:14-30`.

## `requireRole(...roles)`

Restricts a route to one or more roles. Must be used **after** `requireAuth` — it reads `req.user`, which only `requireAuth` sets. If `req.user` is missing or its role isn't in the allowed list, responds `403`.

See `backend/src/middleware/auth.ts:36-44`.

## The four roles

`"customer" | "agent" | "admin" | "subadmin"` — see `backend/src/models/User.ts:3`. `admin` is the full/main admin, always has every permission, and is only ever provisioned directly in the database (`backend/scripts/seed-admin.ts`) — there is no API that creates one. `subadmin` is a delegated staff tier, created through the app, whose specific permissions are configured in Story 46 (`security-admin` feature) — there is no finer-grained permission system yet for it.

## Pattern for a new protected route

```ts
router.post(
  "/",
  requireAuth,
  requireRole("agent", "admin"),
  (req, res) => {
    // req.user.id, req.user.role available and trustworthy here
  }
);
```

Matches the existing precedent in `backend/src/routes/ticket.routes.ts` and `backend/src/routes/conversation.routes.ts`.

## `requirePermission(key)`

Restricts a route to callers holding a specific permission from the fixed vocabulary in `backend/src/constants/permissions.ts`'s `PERMISSION_KEYS`. Must be used **after** `requireAuth`. `admin` always passes (fixed, not configurable). `agent`/`subadmin` are checked with a **live DB lookup on every request** — no caching — against **that individual caller's own** `User.permissions` field, via the shared `hasPermission()` helper (`backend/src/services/permissions.ts`). Permissions are granted per individual agent/sub-admin account, not per role — there is no shared role-level default. Any other caller (`customer`, or none) is rejected with `403`.

```ts
router.get(
  "/",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  requirePermission("users:manage"), // admin short-circuits inside requirePermission itself
  handler
);
```

When a check depends on data only available after loading a document (e.g. "is the *target* of this action an admin?"), don't try to compose `requirePermission` as route-level middleware for that branch — call the exported `hasPermission(userId, key)` helper directly inside the handler instead (see `backend/src/routes/admin.routes.ts`'s `canManageTarget()` for the pattern).

See `backend/src/middleware/auth.ts`'s `requirePermission` function and `backend/src/services/permissions.ts`.

## Rule: never read role from anywhere but the verified JWT

**Never** read the caller's role from `req.body`, `req.query`, `req.params`, or any header other than `Authorization`. `requireAuth` only trusts the JWT's signature-verified payload — this is what prevents a client from self-escalating by sending `{ "role": "admin" }` in a request body. The same applies to permissions: `requirePermission` only ever trusts a live DB read of the caller's own account, never anything client-supplied.
