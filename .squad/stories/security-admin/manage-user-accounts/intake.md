# Story intake

- Folder: `.squad/stories/security-admin/manage-user-accounts/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Security Admin
- **Feature slug (folder under `plans/`):** `security-admin`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `45` *(Story 45 in USER_STORIES.md)*
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
As an admin, I want to create agent and sub-admin accounts, view every
staff account, and deactivate any of them, so that I control who is
allowed to work on the platform and at what level.
```

---

## Acceptance criteria

```
- Admin can create a new account with a role of agent or sub-admin only
  — no "admin" option. Full admin accounts are never created through
  the app; they are provisioned directly in the database.
- Staff-account actions are gated by granular, independently-grantable
  permissions rather than one shared key: viewing the roster requires
  `staff:view_list`, opening one account requires `staff:view_account`,
  creating an account or editing its name/email/role requires
  `staff:edit`, and activating/deactivating an account requires
  `staff:toggle_status` (admin always has all of them; a sub-admin only
  if granted the specific one).
- Deactivating an existing admin account is a separate, narrower action:
  always requires a full admin, regardless of permissions.
- A newly created sub-admin starts with no permissions granted (Story 46
  assigns them, as part of the same account-creation flow).
- Deactivating a user immediately revokes access and excludes agents from
  auto-assignment.
- Account list shows every staff account (agent, admin, sub-admin) with
  role and current online/offline status.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 1 (sign-up, `POST /register` is customer-only by design) — this story is the counterpart for admin-created agent/sub-admin accounts (not admin — see below). Story 21 (agent availability toggle, `isOnline`) — "excludes agents from auto-assignment" ties to the same `isOnline`/role query used by ticket-management Story 10 and live-chat Story 17. Story 46 (configure roles and permissions) — a newly created sub-admin account starts with an empty permission set, assigned later via that story's screen; this story only needs to create the account with the right role value.
- **Depends on code areas or other stories:** `backend/src/models/User.ts` (`role`, `isActive`, `isOnline` — all already on the schema; `role`'s type needs a fourth value, `"subadmin"`, added alongside `"customer"|"agent"|"admin"`), `backend/src/middleware/auth.ts` (`requireRole("admin")`), `backend/scripts/seed-admin.ts` (the existing precedent for how `admin` accounts are actually provisioned — directly in the database, not through any API this story builds).

## Extra notes (optional)

- **Admin accounts are never created through the app.** `role: "admin"` is not a valid value for this story's creation endpoint — only `"agent"` and `"subadmin"`. Admin accounts are provisioned directly in the database (see `backend/scripts/seed-admin.ts`'s existing pattern) — this story does not add a second way to mint one. This removes the self-escalation concern for *creation* entirely: since no in-app path can ever produce a new `admin`, `staff:edit` needs no special carve-out on the create endpoint.
- Creating an agent/sub-admin account: reuse the SAME password-hashing (`bcryptjs`) pattern already established in Story 1's `/register` — don't reinvent hashing logic. This endpoint differs from `/register` only in: (a) staff-only access, gated as below, (b) `role` is settable (`"agent"` or `"subadmin"` only, never `"customer"` or `"admin"`), (c) may generate a temporary password rather than requiring the admin to choose one.
- **The cap is on status changes, not creation.** Creating an `agent`/`subadmin` account or editing its name/email/role requires `staff:edit`; activating/deactivating one requires `staff:toggle_status` — each delegable independently to a sub-admin who's been granted that specific key (Story 46's `requirePermission` mechanism; `admin` always passes both). Toggling the status of an **existing `admin` account** (these exist via DB provisioning, so the roster/deactivate endpoints must still handle them) is a separate, narrower check: always `requireRole("admin")` regardless of permissions — a sub-admin holding `staff:toggle_status` cannot deactivate a higher-privileged account.
- The roster (`GET`) should list all three staff roles (`agent`, `admin`, `subadmin`) for visibility, even though `admin` is never a creation target here. Viewing the roster itself is its own permission, `staff:view_list` — distinct from `staff:edit`/`staff:toggle_status`, so a sub-admin can be granted read-only visibility into the roster without also being able to act on it.
- Since this story (08 in plan sequence) executes before Story 46 (configure-roles-and-permissions, which builds the granular `staff:*` permission model and `requirePermission` middleware), this story cannot literally call `requirePermission(...)` yet. Gate on `requireRole("admin")` for now with code comments marking the spot Story 46 converts each action to its matching key (`GET` → `staff:view_list`, `POST` → `staff:edit`, `PATCH .../deactivate` agent/subadmin branch → `staff:toggle_status`) once the permission layer exists — do not block this story on Story 46 landing first, and do not build a throwaway partial permission model here. The admin-target deactivation check stays `requireRole("admin")` permanently — no TODO on that branch.
- The shipped account-management surface grew beyond this story's own three actions to also include viewing a single account's detail and soft-deleting one (backed by a new `isDeleted` flag on `User`, hiding the account from the roster and locking it out while keeping the document for referential integrity) — a natural extension of this same story's territory rather than Story 46's. What Story 46 actually contributes on top is the permission *keys* that gate those actions (`staff:view_account`, `staff:delete`) alongside the ones already listed above, the per-account `permissions` field itself, and changing an account's granted permissions (`staff:permissions`, edited as a step inside the same creation/edit flow rather than a separate screen). This story's own scope stays limited to create/roster/deactivate.
- "Deactivating immediately revokes access" — since auth is stateless JWT (no server-side session store), an already-issued JWT for a deactivated user remains cryptographically valid until it expires. Revocation in practice means: (a) set `isActive: false`, and (b) `requireAuth`/login paths must re-check `isActive` on each request or at minimum at login (Story 2's login already checks `isActive` at login time — but a currently-logged-in deactivated user's EXISTING token would still pass `requireAuth`, which only checks JWT signature/expiry, not `isActive`, since `requireAuth` doesn't hit the DB). Flag this explicitly: true immediate revocation would require `requireAuth` to do a DB lookup per request (a bigger, cross-cutting change affecting middleware used by every protected route) — note this tradeoff rather than silently claiming full revocation when only login-time enforcement is delivered.
- "Excludes agents from auto-assignment" is already naturally true if Stories 10/17's queries filter `isOnline: true` AND a deactivated agent should also have `isOnline` forced to `false` on deactivation — add that as an explicit side effect of deactivation.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("admin")` for all endpoints in this story (see Extra notes — this story predates Story 46's `requirePermission` middleware, so delegation via the granular `staff:view_list`/`staff:edit`/`staff:toggle_status` keys is a follow-up conversion, not built here). Mark each conversion point with a comment so Story 46's executor finds it.

## Out of scope

- Creating an `admin` account through the app, in any form — admin accounts are DB-provisioned only (see Extra notes). Do not add an invite flow, a "promote to admin" action, or any other in-app path that produces one.
- Assigning or editing sub-admin permissions — that's Story 46, a separate, immediately-following story. This story only creates the account with a role value.
- Actually wiring `requirePermission("staff:view_list" | "staff:edit" | "staff:toggle_status")` — the middleware doesn't exist until Story 46. This story gates on `requireRole("admin")` with marked conversion points (see Extra notes).
- Full session-invalidation infrastructure (e.g. a token blocklist) — flag the JWT-revocation tradeoff per Extra notes rather than building one unprompted.
