# Story intake

- Folder: `.squad/stories/security-admin/configure-roles-and-permissions/intake.md`

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
Configure roles and permissions
```

---

## Description

```
As an admin, I want to review and adjust what each role is allowed to do,
so that sensitive data/actions stay limited to the right people.
```

---

## Acceptance criteria

```
- Permissions are viewable/editable per role (view reports, manage users,
  delete tickets, etc.).
- Permission changes take effect immediately for affected users.
- Default roles ship with sensible out-of-the-box permissions.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 3 (RBAC) — this story extends the existing three-role model with a finer-grained permission layer on top, it does not replace `requireAuth`/`requireRole`.
- **Depends on code areas or other stories:** `backend/src/middleware/auth.ts` (`requireRole`, `UserRole`), `backend/src/models/User.ts` (`role` enum, currently fixed at `"customer"|"agent"|"admin"`).

## Extra notes (optional)

- This is a genuinely significant architectural addition: introducing a PERMISSION layer beyond the existing three hardcoded roles. This needs a new model (e.g. `RolePermission`: `role`, `permissions: string[]`) and a way for route handlers to check a specific permission (e.g. `requirePermission("manage_users")`) in addition to, or instead of, plain `requireRole`. Given every existing route in the codebase uses `requireRole` directly (not a permission-check layer), retrofitting this is a larger change — build the NEW permission-checking capability as an addition (e.g. `requirePermission` middleware backed by the new model, checked against the caller's role's permission set), but do NOT go back and rewrite every existing route's `requireRole` calls to use it — that's a much larger refactor than this one story's acceptance criteria implies. New routes can adopt `requirePermission` going forward; existing routes keep working via `requireRole` unless a later story explicitly migrates them.
- "Default roles ship with sensible out-of-the-box permissions" — seed reasonable defaults (e.g. admin: all permissions; agent: view/reply to tickets & chats, no user management; customer: N/A, customers don't have workspace permissions) at first use / a seed script, not requiring manual admin setup before the system is usable.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("admin")` for the permission-configuration endpoints themselves.

## Out of scope

- Retroactively converting every existing `requireRole` call site to `requirePermission` — additive only, per Extra notes.
- User account management itself (Story 44, separate, already-planned story).
