# Story intake

- Folder: `.squad/stories/security-admin/review-audit-logs/intake.md`

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
Review audit logs
```

---

## Description

```
As an admin, I want to see a log of key actions (logins, edits, deletions,
reassignments), so that I can investigate issues and stay accountable.
```

---

## Acceptance criteria

```
- Log entries include who did what, when, and (where available) from
  where.
- Audit log is read-only and cannot be edited or deleted by regular users.
- Log is filterable by user, action type, and date range.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** This is the SAME open "where does change history live" question flagged repeatedly across earlier stories' intakes (ticket-management Stories 9/11/13, sla-automation Story 25, security-admin Story 47) — every one of those deferred the decision to whichever story built the real audit mechanism first. If any of those stories already landed with their own bespoke history array by the time this is planned/executed, this story should consolidate around ONE actual audit-log model rather than leaving several incompatible mini-histories scattered across `Ticket`/`SlaTarget`/etc. — reconcile explicitly.
- **Depends on code areas or other stories:** No existing audit-log model — this is the natural home for a NEW, dedicated model (e.g. `AuditLog`: `actor`, `action`, `targetType`, `targetId`, `metadata`, `ipAddress?`, `createdAt`).

## Extra notes (optional)

- "From where" (IP address) — Express exposes `req.ip`; capture it where available, but treat it as optional (proxies/load balancers can affect accuracy — not this story's concern to solve).
- This model should be written-to by OTHER stories' actions (logins, ticket edits, reassignments, etc.) as they happen — but retrofitting every existing/planned mutation across the whole codebase to also write an audit entry is a large cross-cutting change beyond one story. Scope this story's OWN deliverable as: the `AuditLog` model + a read/filter endpoint for admins, plus wiring it into 2-3 concrete, already-built actions as a proof of pattern (e.g. login success/failure from Story 2, account deactivation from Story 44) — and explicitly flag that comprehensively wiring every mutation across the app is a larger, ongoing effort, not a one-story task.
- "Cannot be edited or deleted by regular users" — simplest enforcement: don't expose ANY update/delete endpoint for this model at all (write-only via internal calls, read-only via the admin API) rather than building permission checks for operations that don't need to exist.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("admin")` for the read/filter endpoint.

## Out of scope

- Retrofitting audit logging into every existing mutation across the entire codebase — proof-of-pattern wiring only, per Extra notes.
- System configuration itself (Story 47, separate story) — though Story 47 explicitly says its own changes "feed" this story's log.
