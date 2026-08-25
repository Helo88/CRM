# Story intake

- Folder: `.squad/stories/agent-workspace/quick-canned-replies/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Agent Workspace
- **Feature slug (folder under `plans/`):** `agent-workspace`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `23` *(Story 23 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `agent-workspace`

---

## Title

```
Quick/canned replies
```

---

## Description

```
As a human agent, I want to insert pre-written reply templates into my
responses, so that I can answer common questions faster and more
consistently.
```

---

## Acceptance criteria

```
- Quick replies are organized by category and searchable.
- Selecting one inserts it into the reply box for editing before sending.
- Admins manage the shared library of quick replies (feeds
  `security-admin`).
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none functionally required, but naturally consumed from the ticket/chat reply UI once those exist (Stories 11, 18).
- **Depends on code areas or other stories:** No existing model — this story needs a NEW model (e.g. `QuickReply`: `title`, `category`, `body`, `createdBy`). Story 47 (`security-admin`, "system configuration") is named in the acceptance criteria as the eventual home for admin management, but that feature is much later in the build order — build the admin CRUD here, directly, rather than waiting.

## Extra notes (optional)

- "Organized by category and searchable" — a simple `category` string field plus a text-search endpoint (`GET /api/v1/quick-replies?q=...&category=...`) is sufficient; no need for a dedicated search engine.
- "Admins manage the shared library" (write access: admin-only) vs. agents/admins both being able to READ/select replies when composing — two different permission levels on the same resource, similar in shape to Story 4's customer-profile split (agent/admin edit vs. customer self-edit). Confirm which roles can WRITE (admin only, per "Admins manage") vs. READ (agent + admin, since agents are the ones inserting them).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- "Selecting one inserts it into the reply box for editing" is a frontend interaction detail — relevant once a reply-composer UI exists (Story 18 for chat, Story 11 for tickets); if those aren't built yet, this story can deliver the backend CRUD/search API and leave the composer-insertion wiring as a follow-up noted explicitly.

## Out of scope

- Tasks/reminders (Story 22, separate story).
- Internal team collaboration (Story 24, separate story).
- The full `security-admin` "system configuration" area (Story 47, separate, much later feature) — this story's admin CRUD is standalone, not part of that unified settings UI.
