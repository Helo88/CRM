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
- Dashboard clearly separates/labels live chats vs. tickets.
- Items are sorted with the newest/most urgent surfaced first (e.g. an
  active chat or a ticket close to SLA breach).
- Agent can open any item directly from the dashboard to respond.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** ticket-management (Stories 8-13) and live-chat (Stories 14-19) — this dashboard aggregates their data; sla-automation (Stories 25-27) for "close to SLA breach" sorting.
- **Depends on code areas or other stories:** `backend/src/models/Ticket.ts` (`assignedAgent`), `backend/src/models/Conversation.ts` (`assignedAgent`).

## Design system note

This project has an established design system (shadcn/ui, Radix-based, violet/indigo palette) documented in the root `CLAUDE.md` under "Design system" — base primitives already installed in `frontend/components/ui/` (card, badge, table, tabs, avatar, etc.), semantic status tokens `bg-success`/`bg-warning`/`bg-destructive` for on-track/at-risk/breached indicators. Use these; do not introduce a different component library or hand-rolled styling.

## Extra notes (optional)

- Backend: an aggregation endpoint combining `Ticket.find({ assignedAgent: req.user.id })` and `Conversation.find({ assignedAgent: req.user.id })`, similar in shape to Story 6's customer-history aggregation (merge two collections into one sorted list, tagged by type) — if Story 6 already established a pattern for this kind of merge, follow it.
- "Most urgent surfaced first" depends on SLA status (sla-automation, Stories 25-27) — if those aren't implemented yet when this is planned, sort by a reasonable proxy (e.g. `createdAt` ascending / oldest-first) and flag that true urgency-based sorting is a follow-up once SLA data exists.
- This is the first story to need real FRONTEND work beyond the placeholder scaffold (`frontend/app/page.tsx` is still a backend-health-check placeholder). Building the actual dashboard page is in scope here.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("agent","admin")`.

## Out of scope

- Agent availability toggle (Story 21, separate, immediately-following story).
- Tasks/reminders, quick replies, internal collaboration (Stories 22-24, separate stories) — those are additions to the workspace, not this dashboard's core list view.
