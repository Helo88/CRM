# Story intake

- Folder: `.squad/stories/security-admin/configure-roles-and-permissions/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Security Admin
- **Feature slug (folder under `plans/`):** `security-admin`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `46` *(Story 46 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `security-admin`

---

## Title

```
Configure roles and permissions
```

---

## Description

```
As an admin, I want to grant and revoke specific permissions for the
agent and sub-admin roles, so that sensitive actions stay limited to the
right people without making every sub-admin a full admin.
```

---

## Acceptance criteria

```
- Admin (the full/main admin role) is fixed and always has every
  permission — nothing to configure there; only the agent and sub-admin
  rows are editable.
- Permissions are granted/revoked per role from a fixed list of named
  permissions covering account management, ticket/chat actions (delete,
  reassign), SLA and system config, KB publishing, reports, and audit
  access.
- Permission changes take effect immediately for affected users (checked
  live per request, not cached in the session/JWT).
- Agent ships with sensible working-level defaults; sub-admin starts with
  none granted until an admin assigns them.
- Every action currently hardcoded as admin-only elsewhere in the app
  (customer roster/creation, SLA targets, KB publishing, etc.) is covered
  by one of these named permissions, so a sub-admin can be granted that
  one action instead of full admin access.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 3 (RBAC) — this story extends the existing role model with a finer-grained permission layer on top of `requireAuth`/`requireRole`, and also extends the role model itself from three values to four. Story 45 (manage user accounts) — sub-admin accounts must exist (created there) before this story's screen has anything to assign permissions to.
- **Depends on code areas or other stories:** `backend/src/middleware/auth.ts` (`requireRole`, `UserRole`), `backend/src/models/User.ts` (`role` enum — extend from `"customer"|"agent"|"admin"` to add `"subadmin"`), every existing route file that currently gates an action with `requireRole("admin")` where that action should be delegable to a sub-admin (see Extra notes for the specific list found in the codebase today).

## Extra notes (optional)

- This is a genuinely significant architectural addition: a fourth role (`subadmin`) plus a PERMISSION layer that governs both `agent` and `subadmin`. `admin` is the full/main admin — it is hardcoded to always pass every permission check and has no row in the new permission store, so there is no way to misconfigure it into a locked-out state. Build: (1) a new `RolePermissions` model (one document per configurable role — `agent`, `subadmin` — holding a set of granted permission keys), (2) a `requirePermission(key)` middleware that short-circuits `true` for `role === "admin"` and otherwise does a live DB lookup against that role's `RolePermissions` document (live lookup, not cached — required by "changes take effect immediately").
- Unlike a typical additive permission layer, this one DOES need to touch existing routes: every current `requireRole("admin")` (or `requireRole("agent","admin")` where the admin-only branch matters) call site whose action should be delegable to a sub-admin should convert to `requirePermission(key)` instead, using the matching key from the list below. This was an explicit decision (over "sub-admin = admin baseline minus restrictions") specifically so a sub-admin only ever gains exactly what they're granted, not admin-by-default. At minimum, convert the customer roster/creation endpoints (`customer.routes.ts`, currently `requireRole('agent','admin')` — the admin-equivalent portion becomes `customers:manage`).
- Permission key vocabulary (seed these as the fixed list the UI offers): `users:manage`, `users:permissions`, `audit:view`, `config:edit`, `customers:manage`, `tickets:delete`, `tickets:reassign`, `tickets:view_all`, `sla:configure`, `kb:publish`, `reports:view`, `reports:export`, `ai:override_category`.
- `users:manage` is capped, not a flat "grant = full account control" — but the cap is on **deactivation**, not creation. Admin accounts are never created through the app at all (Story 45 restricts its creation endpoint to `agent`/`subadmin` only; real admin accounts are provisioned directly in the database), so there's no creation-side escalation risk to guard against. The real risk is a sub-admin holding `users:manage` deactivating an *existing* admin account: that must always stay `requireRole("admin")` regardless of the permission, enforced inside Story 45's `PATCH /:id/deactivate` handler (target-role branch), not as a route-level cap on creation. Don't build a variant of `requirePermission` that would let `users:manage` bypass that specific branch.
- "Default roles ship with sensible out-of-the-box permissions" — seed `agent`'s `RolePermissions` document with working-level defaults (e.g. `tickets:reassign`, `reports:view`, `ai:override_category`); seed `subadmin`'s document empty (no permissions) so a fresh sub-admin genuinely has to be granted access explicitly, per this story's own acceptance criteria.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("admin")` for the permission-configuration endpoints themselves (only the full admin can edit agent/sub-admin permissions — not delegable, same reasoning as Story 45's account creation).

## Out of scope

- Per-user permission overrides — permissions are strictly per-role (`agent`, `subadmin`), not layered on top of individual accounts.
- Converting every single `requireRole` call site in the app in this one story — convert the admin-only ones that should be sub-admin-delegable (see Extra notes); customer-vs-staff boundaries that were never about admin-vs-sub-admin nuance can stay as plain `requireRole`.
- User account management itself (Story 45, separate, already-planned story) — this story only assigns permissions to roles that already exist.
