# Auth middleware — RBAC convention

## `requireAuth`

Verifies the `Authorization: Bearer <jwt>` header against `JWT_SECRET`. On success, attaches `req.user = { id, role }` (decoded from the JWT's `{ sub, role }` payload) and calls `next()`. On any failure — missing header, malformed token, expired token, wrong signature — responds `401` and does not call `next()`.

See `backend/src/middleware/auth.ts:14-30`.

## `requireRole(...roles)`

Restricts a route to one or more roles. Must be used **after** `requireAuth` — it reads `req.user`, which only `requireAuth` sets. If `req.user` is missing or its role isn't in the allowed list, responds `403`.

See `backend/src/middleware/auth.ts:36-44`.

## The three roles

`"customer" | "agent" | "admin"` — see `backend/src/models/User.ts:3`. There is no finer-grained permission system yet; that's Story 45 (`security-admin` feature).

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

## Rule: never read role from anywhere but the verified JWT

**Never** read the caller's role from `req.body`, `req.query`, `req.params`, or any header other than `Authorization`. `requireAuth` only trusts the JWT's signature-verified payload — this is what prevents a client from self-escalating by sending `{ "role": "admin" }` in a request body.

## Fine-grained permissions

Beyond the three roles above (e.g. "can this specific agent delete tickets"), see Story 45 (`security-admin` feature) — not built yet.
