# Story intake

- Folder: `.squad/stories/agent-workspace/agent-availability-toggle/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Agent Workspace
- **Feature slug (folder under `plans/`):** `agent-workspace`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `21` *(Story 21 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `agent-workspace`

---

## Title

```
Agent availability toggle
```

---

## Description

```
As a human agent, I want to mark myself online/available or offline/away,
so that the system only auto-assigns new work to me when I can respond.
```

---

## Acceptance criteria

```
- Toggle is visible and changeable at any time from the dashboard.
- Auto-assignment (chats and tickets) only considers agents currently
  marked online.
- The agent's status is visible to the admin.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 20 (unified dashboard) for the UI surface. THIS STORY IS A HARD, EXPLICITLY-FLAGGED DEPENDENCY of Story 10 (ticket auto-assign) and Story 17 (chat auto-assign) — both of those stories' intakes note that `User.isOnline` is never set to `true` by any existing code path until this story ships, meaning their auto-assignment queries find zero eligible agents until this story exists. Implementing this story is what unblocks Stories 10 and 17's acceptance criteria being actually satisfiable end-to-end.
- **Depends on code areas or other stories:** `backend/src/models/User.ts` (`isOnline: boolean`, default `false`, already on the schema).

## Extra notes (optional)

- This is a small, focused story: a `PATCH`-style endpoint (`backend/src/routes/` — no dedicated agent/user-settings route file exists yet, may need one, e.g. `agent.routes.ts` or extend an existing one) to flip `User.isOnline` for the authenticated agent, plus surfacing that value to admins.
- "Visible to the admin" — likely a list of agents with their `isOnline` status; if Story 44 (`security-admin`, "manage user accounts") already builds an account list, this could feed into or extend that view rather than duplicating one — but Story 44 is a much later feature, so build a minimal version here rather than blocking on it.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("agent","admin")` for the toggle; admin visibility likely `requireRole("admin")` for a full-list view (or "agent","admin" if agents can see each other's status too — not specified, default to admin-only unless the acceptance criteria implies otherwise).

## Out of scope

- The actual consumption of `isOnline` in auto-assignment queries (Stories 10 and 17, separate, earlier-planned stories) — this story only makes the flag settable/queryable.
