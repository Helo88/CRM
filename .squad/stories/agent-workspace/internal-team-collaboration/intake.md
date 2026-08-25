# Story intake

- Folder: `.squad/stories/agent-workspace/internal-team-collaboration/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Agent Workspace
- **Feature slug (folder under `plans/`):** `agent-workspace`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `24` *(Story 24 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `agent-workspace`

---

## Title

```
Internal team collaboration
```

---

## Description

```
As a human agent, I want to tag colleagues and leave internal comments on
a ticket or chat, so that we can collaborate without the customer seeing
our internal discussion.
```

---

## Acceptance criteria

```
- Internal comments are clearly separated from customer-facing replies.
- Tagging a colleague sends them a notification.
- Internal comments are included in the ticket/chat's audit history.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 13 (view full ticket history) — internal comments should feed the same history mechanism that story establishes, per its own intake note.
- **Depends on code areas or other stories:** `backend/src/models/Message.ts` — `internal: boolean` field ALREADY EXISTS on the schema exactly for this purpose ("agent-only notes (agent-workspace Story 24) — never shown to the customer," per the model's own doc comment). This story is largely about exposing an endpoint to create `Message` documents with `internal: true` on a ticket/conversation, plus the "tagging" mechanic.

## Extra notes (optional)

- "Tag colleagues" needs a way to reference other users in comment text (e.g. `@userId` or `@email` parsing) — no existing mention/tagging mechanism anywhere in the codebase. Keep it simple: parse `@<user id>` tokens from the comment text, or accept an explicit `taggedUserIds: string[]` field in the request body rather than free-text parsing, whichever is simpler to implement correctly — free-text @mention parsing is more fragile (ambiguous boundaries, unicode names) and not required by the acceptance criteria's wording.
- "Sends them a notification" — same recurring gap as Stories 10/12/22: no notification model exists. Given this is real-time collaboration between agents already likely online, a Socket.io push (if the tagged agent has an active connection) is a more natural fit than email here — but note the choice explicitly.
- "Included in the audit history" — depends on Story 13's history read model; `Message.internal: true` documents already show up in the same `parentType`/`parentId` query Story 13 uses, so as long as Story 13's implementation includes internal messages (filtered appropriately for agent vs. admin views), no extra work is needed here beyond creating the message correctly.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireAuth`, `requireRole("agent","admin")`. `internal: true` messages must NEVER be returned by any customer-facing read endpoint — this is a hard security/privacy boundary, call it out explicitly wherever tickets/conversations are read.

## Out of scope

- Tasks/reminders (Story 22, separate story) and quick replies (Story 23, separate story) — distinct features, not to be conflated with internal comments.
