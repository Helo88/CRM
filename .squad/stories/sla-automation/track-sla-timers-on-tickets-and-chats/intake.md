# Story intake

- Folder: `.squad/stories/sla-automation/track-sla-timers-on-tickets-and-chats/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** SLA Automation
- **Feature slug (folder under `plans/`):** `sla-automation`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `26` *(Story 26 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `sla-automation`

---

## Title

```
Track SLA timers on tickets and chats
```

---

## Description

```
As the system, I want to track elapsed time against the applicable SLA
target on every open ticket/chat, so that agents and managers always know
how much time is left.
```

---

## Acceptance criteria

```
- Each ticket/chat shows a visible countdown or elapsed-time indicator
  against its SLA target.
- Timers pause appropriately when waiting on the customer (e.g. ticket
  status "Answered," awaiting reply) if that logic is enabled.
- SLA status (on-track / at-risk / breached) is visible in list views and
  reports.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 25 (define SLA targets) — this story computes `sla.responseTargetAt`/`resolutionTargetAt` on ticket/conversation creation using Story 25's configured targets. Story 8 (submit a ticket) and Story 14 (start a live chat) are the creation points where this hooks in.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`sla: { responseTargetAt, resolutionTargetAt, breached }`), `backend/src/models/Conversation.ts` (`sla: { responseTargetAt, breached }`).

## Extra notes (optional)

- This is a compute/derive concern, not primarily new schema — at ticket/conversation creation time, look up the applicable `SlaTarget` (from Story 25's model, matched by category/priority, falling back to the default) and set `responseTargetAt`/`resolutionTargetAt` accordingly.
- "Visible countdown ... in list views" is primarily a FRONTEND concern once list views exist (agent dashboard is Story 20, a later feature) — for this story, focus on the backend deriving and exposing an SLA STATUS field (`"on_track" | "at_risk" | "breached"`) computable from `sla.responseTargetAt`/`resolutionTargetAt` vs. the current time, e.g. a virtual/computed field or a scheduled job that periodically flips `sla.breached`. Note explicitly whether this story delivers a stored/computed status or requires the frontend to compute it client-side from the raw timestamps — don't assume a frontend exists to build against yet.
- "Timers pause when waiting on the customer, if that logic is enabled" — the "if that logic is enabled" wording suggests this is optional/configurable. Treat pausing as a stretch goal; the core requirement is the elapsed-time tracking against a fixed target. If pausing is implemented, it needs a way to record "paused at" / accumulated-paused-duration, which doesn't exist on the schema yet — flag as new fields if pursued.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Consider whether SLA status is computed on-read (a query-time calculation, no extra storage, always accurate) vs. a background job that periodically updates `breached` (needed if e.g. an alert must fire even with no incoming request — relevant to Story 27). If Story 27 (breach alerts) needs to PROACTIVELY notify on breach rather than just report it when queried, a background job/scheduler is likely necessary — flag this cross-story need rather than deciding it unilaterally in isolation.

## Out of scope

- SLA breach alerts / auto-escalation trigger (Story 27, separate, immediately-following story) — this story only tracks/exposes status, doesn't act on breaches.
- Any frontend dashboard UI (Story 20 and later features) — backend/API surface only.
