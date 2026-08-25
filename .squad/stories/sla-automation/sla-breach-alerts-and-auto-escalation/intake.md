# Story intake

- Folder: `.squad/stories/sla-automation/sla-breach-alerts-and-auto-escalation/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** SLA Automation
- **Feature slug (folder under `plans/`):** `sla-automation`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `27` *(Story 27 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `sla-automation`

---

## Title

```
SLA breach alerts and auto-escalation
```

---

## Description

```
As a human agent, I want to get an alert when one of my items is close to
or has breached its SLA, so that I can act before — or immediately after —
it's too late.
```

---

## Acceptance criteria

```
- Alerts trigger at configurable thresholds (e.g. 75% of time elapsed) and
  again on breach.
- A breach can automatically trigger the escalation flow (Story 12 /
  Story 16).
- Breached items are visibly flagged in dashboards and reports (feeds
  `reports-management`).
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 26 (track SLA timers) — this story fires off the status Story 26 computes. Story 12 (ticket-management, "Escalate a ticket") and Story 16 (live-chat, "Escalate to a human agent") are the escalation flows this story triggers automatically — both were already planned earlier and their intakes explicitly flagged this exact forward-dependency ("automatically on an SLA breach (feeds from sla-automation Story 27)").
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`escalatedTo`, `status: "escalated"`), `backend/src/models/Conversation.ts` (`status: "escalated"`), `backend/src/services/email.service.ts` (for the alert notification).

## Extra notes (optional)

- This story needs something to run PROACTIVELY (not just on-request) to detect approaching/breached SLAs and fire alerts — as flagged in Story 26's intake, this likely requires a background job/scheduler (e.g. `setInterval` in `server.ts`, or a cron-style job) since there's no existing job infrastructure in this codebase to reuse. Note the chosen mechanism explicitly; don't silently assume one exists.
- "Automatically trigger the escalation flow (Story 12/16)" — call whatever manual-escalation function those stories exposed (per their own intakes' Extra notes, both were asked to expose an importable function, not just an inline HTTP handler, specifically so this story could call it) rather than duplicating escalation logic here.
- "Feeds reports-management" is a forward reference only — `reports-management` (Stories 39-43) is a much later feature; this story just needs breach status to be queryable (already Story 26's job), not to build any report itself.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- "Configurable thresholds (e.g. 75%)" ties to Story 25's SLA-target model — the threshold percentage itself may need to be a new configurable value (global or per-target) rather than a hardcoded constant.

## Out of scope

- The report views themselves (`reports-management`, Stories 39-43, separate, much later feature).
- Manual escalation UI/logic (Stories 12 and 16, already separate, earlier stories) — this story only triggers them automatically.
