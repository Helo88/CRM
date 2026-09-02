# Story intake

- Folder: `.squad/stories/agent-workspace/unified-agent-dashboard/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Agent Workspace
- **Feature slug (folder under `plans/`):** `agent-workspace`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `20` *(Story 20 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `agent-workspace`

---

## Title

```
Unified agent dashboard
```

---

## Description

```
As a human agent, I want one dashboard listing both my assigned live chats
and my assigned tickets, so that I don't have to check two separate
places.
```

---

## Acceptance criteria

```
- Dashboard presents the agent's assigned open tickets and live chats
  together as a "Triage Board": three columns — Breached / At risk / On
  track — driven by real SLA status (see Extra notes), not a createdAt
  proxy. Tickets and chats are mixed within a column, not split into
  separate lists/sections.
- Within each column, cards are sorted most-urgent-first (nearest
  target time / most overdue first for Breached).
- Each card shows: ticket number or chat id, priority, subject (tickets)
  or customer name (chats), an SLA countdown/elapsed indicator, and the
  assignee avatar.
- Agent can open any item directly from the dashboard to respond.
- Empty columns render an empty state, never disappear (a column always
  exists so the agent can see the shape of their queue at a glance).
- The board refreshes automatically on an interval while the tab is
  visible (and immediately on regaining focus), matching the existing
  polling pattern already used elsewhere in the app (`NotificationBell.tsx`)
  — not a live per-second countdown, not a socket/WebSocket push.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** ticket-management (Stories 8-13) and live-chat (Stories 14-19) — this dashboard aggregates their data; sla-automation (tracker ids `define-sla-targets`, `track-sla-timers-on-tickets-and-chats`, `sla-breach-alerts-and-auto-escalation`) — **already implemented**, unblocking real urgency sorting (see Extra notes).
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`assignedAgent`, nested `sla.responseTargetAt` / `sla.resolutionTargetAt`), `backend/src/models/Conversation.ts` (`assignedAgent`, `responseTargetAt` — chats carry no `resolutionTargetAt`, only a first-response target), `backend/src/services/sla.service.ts`'s `computeSlaStatus()` (pure function: `{responseTargetAt, resolutionTargetAt, currentStatus, now}` → `"on_track"|"at_risk"|"breached"`).

## Design system note

This project has an established design system (shadcn/ui, Radix-based) documented in the root `CLAUDE.md` under "Design system" — base primitives already installed in `frontend/components/ui/` (card, badge, table, tabs, avatar, etc.). Palette is a warm amber/gold primary (`--primary`) on warm off-white/cream neutrals (not violet/indigo — that was an earlier, since-replaced direction); semantic status tokens `bg-success`/`bg-warning`/`bg-destructive` (plus their `-foreground` pairs) are the ones to use for on-track/at-risk/breached indicators — do not invent new status colors. Use these; do not introduce a different component library or hand-rolled styling.

## Extra notes (optional)

- **Design direction agreed: "Triage Board"** — chosen from three concept options mocked up while designing SLA automation's visualization (`SLA View Concepts` artifact: Pulse List / Triage Board / Ops Radar). Triage Board is a 3-column kanban — Breached / At risk / On track — sorted by urgency inside each column, mixing tickets and chats as cards rather than two separate lists/tables. Card anatomy from the concept: id (ticket number or chat id) + priority chip on top row, subject/customer name, bottom row with a color-coded SLA time indicator (e.g. `−38m` for breached-by, `12m` for time remaining) and the assignee avatar. Column left-border/dot color reuses `--destructive`/`--warning`/`--success` respectively — no new colors. This supersedes the two-section ("Live chats" card / "Tickets" card) layout an earlier draft of this story sketched before SLA automation existed.
- Backend: an aggregation endpoint combining `Ticket.find({ assignedAgent: req.user.id })` and `Conversation.find({ assignedAgent: req.user.id })`, similar in shape to Story 6's customer-history aggregation (merge two collections into one sorted list, tagged by type) — if Story 6 already established a pattern for this kind of merge, follow it. Each returned item's `slaStatus` should be computed server-side via `computeSlaStatus()` (don't reimplement the threshold logic in the route or on the frontend) so the three columns are just a group-by over that field.
- "Most urgent surfaced first": now backed by real SLA data — sort by (breach severity desc, nearest/most-overdue target asc) rather than the `createdAt` proxy an earlier draft of this story used as a placeholder pending SLA automation. No `TODO(story-25-sla)` marker needed; the real data exists now.
- This is the first story to need real FRONTEND work beyond the placeholder scaffold (`frontend/app/dashboard/page.tsx` is currently a static tile-grid placeholder, gated by role/permission checks already wired up). Building the actual dashboard page is in scope here — keep the existing tile grid for whichever roles/sections it still legitimately serves (grep the current file before removing anything) and add the Triage Board as the agent-facing workspace view.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("agent","admin")`.

## Out of scope

- Agent availability toggle (Story 21, separate, immediately-following story).
- Tasks/reminders, quick replies, internal collaboration (Stories 22-24, separate stories) — those are additions to the workspace, not this dashboard's core list view.
