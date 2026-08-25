# Story intake

- Folder: `.squad/stories/sla-automation/define-sla-targets/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** SLA Automation
- **Feature slug (folder under `plans/`):** `sla-automation`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `25` *(Story 25 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `sla-automation`

---

## Title

```
Define SLA targets
```

---

## Description

```
As an admin, I want to set response-time and resolution-time targets per
priority level and category, so that service quality is measurable and
consistent.
```

---

## Acceptance criteria

```
- Targets can differ by priority and/or category.
- Changes to SLA targets are logged with date and who made the change.
- Default targets apply to categories/priorities that don't have a custom
  target.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 1-3 (auth, planned) for `requireAuth`/`requireRole("admin")`. Consumed by Story 26 (track SLA timers) and Story 27 (breach alerts), both in this same feature.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`priority: TicketPriority`, `category: string | null`, `sla: { responseTargetAt, resolutionTargetAt, breached }` sub-document — these are per-TICKET fields, not a global config store), `backend/src/models/Conversation.ts` (`sla: { responseTargetAt, breached }` similar per-conversation sub-document).

## Extra notes (optional)

- There is currently NO system-wide "SLA config" model anywhere in the codebase — `Ticket.sla`/`Conversation.sla` only store the RESOLVED target times for one specific ticket/conversation, not the admin-configurable rules that produce them. This story needs a new model (e.g. `SlaTarget` or similar, keyed by priority and/or category, with response/resolution durations) that Story 26 will read from to compute each ticket/conversation's actual `sla.responseTargetAt`/`resolutionTargetAt` at creation time.
- "Logged with date and who made the change" — same open question as Stories 9/11 (ticket-management) about where change history lives; if those stories already settled on a pattern (e.g. a shared audit/history mechanism), reuse it here for consistency rather than inventing a third one.
- "Default targets apply to categories/priorities without a custom target" implies a fallback/default row plus optional overrides — model this explicitly (e.g. a `category: null` or `priority: null` wildcard entry as the default) rather than requiring every combination to be pre-populated.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("admin")` — this is admin-only configuration (ties into Story 47, `security-admin`'s "system configuration," but that feature is much later in the build order; build this story's SLA-target CRUD independently rather than waiting for Story 47).

## Out of scope

- Actually tracking elapsed time / computing on-track-at-risk-breached status on live tickets (Story 26, separate, immediately-following story).
- Breach alerts and auto-escalation (Story 27, separate story).
- The full system-configuration admin area (Story 47, separate, much later feature) — this story only needs its own minimal CRUD, not a unified settings UI.
