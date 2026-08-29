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
As an admin, I want to grant and revoke specific permissions on individual
agent and sub-admin accounts, so that sensitive actions stay limited to the
right people without making every sub-admin a full admin.
```

---

## Acceptance criteria

```
- Admin (the full/main admin role) is fixed and always has every
  permission — nothing to configure there; only agent and sub-admin
  accounts have an editable, individual permission set.
- Permissions are granted/revoked per account (not shared across every
  account of the same role) from a fixed list of named permissions
  covering staff-account management (view roster, view one account,
  edit, activate/deactivate, delete, change permissions), ticket/chat
  actions (delete, reassign), SLA and system config, KB publishing,
  reports, and audit access.
- Staff/system-administration permissions — all six staff-account-
  management keys, plus system config, audit access, SLA config, KB
  publishing, and report export — are sub-admin only and can never be
  granted to an agent account. Every other permission (customer
  management, ticket delete/reassign/view-all, report viewing, AI
  category override) can go to either an agent or a sub-admin.
- Permission changes take effect immediately for affected users (checked
  live per request, not cached in the session/JWT).
- A newly created agent account is pre-populated with sensible
  working-level defaults; a newly created sub-admin starts with none
  granted until an admin assigns them — in both cases this happens as
  part of the same account-creation flow, not a separate step.
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

- This is a genuinely significant architectural addition: a fourth role (`subadmin`) plus a PERMISSION layer that governs both `agent` and `subadmin`, granted **per account** rather than shared per role. `admin` is the full/main admin — it is hardcoded to always pass every permission check and never has a `permissions` list to configure, so there is no way to misconfigure it into a locked-out state. Build: (1) a `permissions: PermissionKey[]` field directly on the `User` document (no separate `RolePermissions` collection — each account's grants are its own, assigned/edited as a step inside that account's own creation/edit flow), (2) a `requirePermission(key)` middleware that short-circuits `true` for `role === "admin"` and otherwise does a live DB lookup against the *calling account's own* `permissions` field (live lookup, not cached — required by "changes take effect immediately").
- Unlike a typical additive permission layer, this one DOES need to touch existing routes: every current `requireRole("admin")` (or `requireRole("agent","admin")` where the admin-only branch matters) call site whose action should be delegable to a sub-admin should convert to `requirePermission(key)` instead, using the matching key from the list below. This was an explicit decision (over "sub-admin = admin baseline minus restrictions") specifically so a sub-admin only ever gains exactly what they're granted, not admin-by-default. At minimum, convert the customer roster/creation endpoints (`customer.routes.ts`, currently `requireRole('agent','admin')` — the admin-equivalent portion becomes `customers:manage`), and the staff-account-management endpoints from Story 45 (see below).
- Permission key vocabulary (seed these as the fixed list the UI offers, 17 keys): `staff:view_list`, `staff:view_account`, `staff:edit`, `staff:toggle_status`, `staff:delete`, `staff:permissions`, `audit:view`, `config:edit`, `customers:manage`, `tickets:delete`, `tickets:reassign`, `tickets:view_all`, `sla:configure`, `kb:publish`, `reports:view`, `reports:export`, `ai:override_category`. The single coarse `users:manage` key (and the orphaned, never-used `users:permissions` key) from an earlier version of this design are gone — replaced by the six granular `staff:*` keys above, each covering exactly one staff-account action instead of all of them at once. `staff:permissions` is the renamed, repurposed successor to the old `users:permissions` key — it now does something real: it gates changing an account's own granted permissions.
- **Sub-admin-only tier, enforced server-side.** All six `staff:*` keys, plus `config:edit`, `audit:view`, `sla:configure`, `kb:publish`, and `reports:export` (11 keys total) can only ever be granted to a `subadmin` account — never to an `agent`. Assigning one of these to an `agent` (at creation or when editing an existing account) must be rejected with a 400, not just hidden in the UI. The remaining 6 keys (`customers:manage`, `tickets:delete`, `tickets:reassign`, `tickets:view_all`, `reports:view`, `ai:override_category`) can go to either role.
- `staff:toggle_status` (and, once account deletion exists, `staff:delete`) are capped, not a flat "grant = full account control" — the cap is on acting on an **existing admin account**, not on creation. Admin accounts are never created through the app at all (Story 45 restricts its creation endpoint to `agent`/`subadmin` only; real admin accounts are provisioned directly in the database), so there's no creation-side escalation risk to guard against. The real risk is a sub-admin holding `staff:toggle_status`/`staff:delete` acting on an *existing* admin account: that must always stay `requireRole("admin")` regardless of the permission, enforced inside Story 45's `PATCH /:id/deactivate` handler (target-role branch) and this story's equivalent delete endpoint. Don't build a variant of `requirePermission` that would let those keys bypass that specific branch.
- "Default roles ship with sensible out-of-the-box permissions" — since permissions are per-account, this is a UI default rather than a persisted record: the account-creation flow pre-selects working-level defaults (e.g. `tickets:reassign`, `reports:view`, `ai:override_category`) when the role picked is `agent`, and nothing when it's `subadmin`, so a fresh sub-admin genuinely has to be granted access explicitly, per this story's own acceptance criteria — but the admin creating the account can still change the pre-selected set before submitting.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Permissions are edited as part of the account resource itself (Story 45's `admin.routes.ts`), gated by `requirePermission("staff:permissions")` — this **is** delegable to a sub-admin who has been granted that key, unlike an earlier version of this design that reserved permission-editing for a true admin only. There is no separate, standalone permission-configuration endpoint or screen.

## Out of scope

- A shared, per-role permission record — permissions are granted per account (`agent` or `subadmin`), not layered on top of a role-wide default that every account of that role inherits.
- Converting every single `requireRole` call site in the app in this one story — convert the admin-only ones that should be sub-admin-delegable (see Extra notes); customer-vs-staff boundaries that were never about admin-vs-sub-admin nuance can stay as plain `requireRole`.
- User account management itself (Story 45, separate, already-planned story) — this story only assigns permissions to roles that already exist, though the permission-editing surface itself lives inside that story's account creation/edit UI (see Extra notes).
