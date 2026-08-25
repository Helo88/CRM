# Story intake

- Folder: `.squad/stories/reports-management/management-dashboard/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Reports Management
- **Feature slug (folder under `plans/`):** `reports-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `43` *(Story 43 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `reports-management`

---

## Title

```
Management dashboard
```

---

## Acceptance criteria

```
- Dashboard is configurable per role.
- Data refreshes automatically or on a defined schedule.
- Dashboard links out to the detailed reports above for drill-down.
```

---

## Description

```
As a manager or executive, I want one high-level dashboard combining
ticket volume, SLA performance, agent performance, and CSAT, so that I
can make decisions at a glance.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 39-42 (all four report types) — this story is a composed summary view over all of them, the last story in this feature by design.
- **Depends on code areas or other stories:** Whatever endpoints Stories 39-42 exposed.

## Extra notes (optional)

- This is primarily a FRONTEND aggregation story: one dashboard page that calls Stories 39-42's existing endpoints and displays summary tiles/charts, with links to each full report page. Avoid building a new mega-endpoint that recomputes everything from scratch — reuse the existing report endpoints.
- "Refreshes automatically or on a schedule" — client-side polling (e.g. refetch every N minutes) is sufficient; no need for Socket.io push for report data.
- "Configurable per role" — likely means admin sees everything, an agent (if given dashboard access at all) sees a narrower subset (e.g. just their own agent-performance metrics, reusing Story 41's self-scoping) — note the actual role-visibility rules chosen.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Reuse the shadcn/ui design system's chart/stat-tile approach already used elsewhere; reuse whatever charting library Story 39 introduced (if any) rather than adding a second one.

## Out of scope

- Any of the four underlying reports' own logic (Stories 39-42, separate, already-planned stories) — this story only composes/links to them.
