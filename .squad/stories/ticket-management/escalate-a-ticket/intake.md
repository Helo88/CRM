# Story intake

- Folder: `.squad/stories/ticket-management/escalate-a-ticket/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `12` *(Story 12 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ticket-management`

---

## Title

```
Escalate a ticket
```

---

## Description

```
As an agent, I want to escalate a ticket to a senior agent or admin when I
can't resolve it myself, so that stuck issues still get resolved.
```

---

## Acceptance criteria

```
- Escalation can be triggered manually by the agent, or automatically on an
  SLA breach (feeds from `sla-automation` Story 27).
- Escalating notifies the target person and visibly flags the ticket in
  lists/dashboards.
- The full ticket history travels with the escalation, so context isn't
  lost.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 8 (submit a ticket), Story 11 (status transitions — escalation is the `"escalated"` status value). Story 27 (`sla-automation`, "SLA breach alerts and auto-escalation") comes AFTER this feature in the build order — the automatic-trigger half of this story's first acceptance criterion cannot be wired up until Story 27 exists.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`status` includes `"escalated"`, `escalatedTo: Types.ObjectId | null`, `sla: { responseTargetAt, resolutionTargetAt, breached }` already on the schema — `breached` exists but nothing currently sets it, since `sla-automation` isn't built).

## Extra notes (optional)

- Build the MANUAL escalation path fully (an endpoint an agent calls to set `status: "escalated"` and `escalatedTo: <target user id>`, notify them, flag it). For the AUTOMATIC path ("on an SLA breach"), since Story 27 doesn't exist yet, do not build SLA-breach detection here — at most, design the manual escalation function so Story 27 can call it later (e.g. an exported function, not logic inlined only in the HTTP handler), and note this explicitly as a forward dependency rather than either skipping the acceptance criterion silently or building SLA timers un-scoped.
- "Notifies the target person" — same constraint as Story 10: no in-app notification model exists yet; email via `email.service.ts` is the available channel.
- "Full ticket history travels with the escalation" — depends on Story 13's ticket-history data existing; if Story 13 isn't implemented yet when this is planned, the escalation at minimum must not lose data (i.e. don't clear/reset any fields), and should note that a proper "history travels" guarantee is completed by Story 13.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("agent", "admin")` for the escalation endpoint. The escalation target (`escalatedTo`) should be another agent or an admin — validate the target user's role.

## Out of scope

- SLA breach detection / auto-escalation trigger (Story 27, separate, later feature — `sla-automation`).
- Full ticket audit history (Story 13, separate story).
