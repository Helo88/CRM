# Story intake

- Folder: `.squad/stories/security-admin/system-configuration/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Security Admin
- **Feature slug (folder under `plans/`):** `security-admin`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `47` *(Story 47 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `security-admin`

---

## Title

```
System configuration
```

---

## Description

```
As an admin, I want to configure system-wide settings (ticket categories,
SLA defaults, quick-reply library, branding), so that the platform matches
how the business actually operates.
```

---

## Acceptance criteria

```
- Settings are centralized in one administration area.
- Changes to critical settings require admin-level permission.
- A history of configuration changes is kept for reference (feeds
  Story 46).
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** This story is explicitly named as the eventual unifying home for several settings that EARLIER stories already built standalone versions of out of necessity (since this feature comes late in the build order): ticket categories (ticket-management Story 9's intake explicitly deferred admin-configurable categories to this story), SLA defaults (sla-automation Story 25's `SlaTarget` model), quick-reply library (agent-workspace Story 23's `QuickReply` model). This story's real job is likely CONSOLIDATION/a unified admin UI over those already-existing models, not rebuilding them from scratch — verify what actually exists by the time this is planned/executed and reconcile rather than duplicate.
- **Depends on code areas or other stories:** `SlaTarget` (Story 25), `QuickReply` (Story 23), `Ticket.category` (Story 9), branding (no existing model — genuinely new for this story).
- Story 46 (audit logs) — this story's own config changes should write to that log, per its acceptance criteria.

## Extra notes (optional)

- "Branding" (logo, colors) has no existing model or file-upload mechanism (same gap noted in customer-management Story 7 and knowledge-base Story 29) — store as URL + hex color values, no new upload infra, consistent with how those earlier stories handled the same gap.
- "Centralized in one administration area" is primarily a FRONTEND information-architecture concern (one settings page aggregating several backend resources) — the backend job is exposing/aggregating whatever config models already exist (SlaTarget, QuickReply, categories, branding) under one discoverable API surface, not necessarily one single mega-model.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("admin")` throughout.

## Out of scope

- Rebuilding SLA targets, quick replies, or ticket categories from scratch if they already exist from their own earlier stories — consolidate, don't duplicate.
- The audit log itself (Story 46, separate story) — this story only needs to WRITE to it.
