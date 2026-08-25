# Story intake

- Folder: `.squad/stories/security-admin/manage-user-accounts/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Security Admin
- **Feature slug (folder under `plans/`):** `security-admin`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `44` *(Story 44 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `security-admin`

---

## Title

```
Manage user accounts
```

---

## Description

```
As an admin, I want to create, view, and deactivate agent and admin
accounts, so that I control who is allowed to work on the platform.
```

---

## Acceptance criteria

```
- Admin can create a new account with a role (agent/admin) and an initial
  password or invite flow.
- Deactivating a user immediately revokes access and excludes agents from
  auto-assignment.
- Account list shows each user's role and current online/offline status.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 1 (sign-up, `POST /register` is customer-only by design) — this story is the counterpart for admin-created agent/admin accounts. Story 21 (agent availability toggle, `isOnline`) — "excludes agents from auto-assignment" ties to the same `isOnline`/role query used by ticket-management Story 10 and live-chat Story 17.
- **Depends on code areas or other stories:** `backend/src/models/User.ts` (`role`, `isActive`, `isOnline` — all already on the schema), `backend/src/middleware/auth.ts` (`requireRole("admin")`).

## Extra notes (optional)

- Creating an agent/admin account: reuse the SAME password-hashing (`bcryptjs`) pattern already established in Story 1's `/register` — don't reinvent hashing logic. This endpoint differs from `/register` only in: (a) admin-only access, (b) `role` is settable (`"agent"` or `"admin"`, never `"customer"` — that's what `/register` is for), (c) may generate a temporary password rather than requiring the admin to choose one.
- "Deactivating immediately revokes access" — since auth is stateless JWT (no server-side session store), an already-issued JWT for a deactivated user remains cryptographically valid until it expires. Revocation in practice means: (a) set `isActive: false`, and (b) `requireAuth`/login paths must re-check `isActive` on each request or at minimum at login (Story 2's login already checks `isActive` at login time — but a currently-logged-in deactivated user's EXISTING token would still pass `requireAuth`, which only checks JWT signature/expiry, not `isActive`, since `requireAuth` doesn't hit the DB). Flag this explicitly: true immediate revocation would require `requireAuth` to do a DB lookup per request (a bigger, cross-cutting change affecting middleware used by every protected route) — note this tradeoff rather than silently claiming full revocation when only login-time enforcement is delivered.
- "Excludes agents from auto-assignment" is already naturally true if Stories 10/17's queries filter `isOnline: true` AND a deactivated agent should also have `isOnline` forced to `false` on deactivation — add that as an explicit side effect of deactivation.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("admin")` for all endpoints in this story.

## Out of scope

- Fine-grained permissions beyond the three roles (Story 45, separate, immediately-following story).
- Full session-invalidation infrastructure (e.g. a token blocklist) — flag the JWT-revocation tradeoff per Extra notes rather than building one unprompted.
