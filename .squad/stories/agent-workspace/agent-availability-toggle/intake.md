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

- **Blocked by / related ids:** NOT blocked by Story 20 (unified dashboard) — Story 20 doesn't exist yet, and this story is being deliberately pulled forward, scoped narrower than the full Story 21 in `USER_STORIES.md`, specifically so it doesn't wait on Story 20. THIS STORY IS A HARD, EXPLICITLY-FLAGGED DEPENDENCY of Story 10 (ticket auto-assign) and Story 17 (chat auto-assign) — both of those stories' intakes note that `User.isOnline` is never set to `true` by any existing code path until this story ships, meaning their auto-assignment queries find zero eligible agents until this story exists. Implementing this story is what unblocks Stories 10 and 17's acceptance criteria being actually satisfiable end-to-end.
- **Depends on code areas or other stories:** `backend/src/models/User.ts` (`isOnline: boolean`, default `false`, already on the schema).

## Extra notes (optional)

- **Scope explicitly narrowed by the user below the full Story 21 in `USER_STORIES.md`:** this pass ships only the `isOnline` flag being real (settable by the agent, visible to admin) — not the full Story 21 dashboard integration. The toggle's frontend surface should be whatever minimal, already-reachable page fits (e.g. `backend/src/routes/me.routes.ts`'s self-scoped pattern for the flip endpoint, surfaced in an existing settings/account page or `SiteHeader`/`UserMenu`), not a new dashboard. The full Story 20/21 dashboard polish is still a separate, later story.
- This is a small, focused story: a `PATCH`-style endpoint — `me.routes.ts` already hosts other self-scoped "my own state" endpoints (`/me/status`, `/me/contact`) with `requireAuth` only, no `requirePermission`; `PATCH /me/status` (or similar) flipping `isOnline` fits that same precedent rather than needing a new route file or a new permission key.
- "Visible to the admin" — `admin.routes.ts` already selects and returns `isOnline` in its staff-account-list endpoint (see `admin.routes.ts:33,87`), so admin visibility may already be satisfied or need only a minor surface tweak — verify against current code rather than assuming a new admin view is needed.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("agent","admin")` for the toggle; admin visibility likely `requireRole("admin")` for a full-list view (or "agent","admin" if agents can see each other's status too — not specified, default to admin-only unless the acceptance criteria implies otherwise).

## Out of scope

- The actual consumption of `isOnline` in auto-assignment queries (Stories 10 and 17, separate, earlier-planned stories) — this story only makes the flag settable/queryable.
