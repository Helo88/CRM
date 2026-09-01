# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/live-chat/notify-available-agents-when-a-chat-needs-a-human/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `live-chat`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Notify available agents when a chat needs a human
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an agent (or subadmin/admin holding chats:manage), I want to be notified
when a live chat is escalated or needs a human, so that I don't have to sit
on the chats list refreshing to notice new work — the same way I already
get notified when a ticket is assigned to me.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- When a conversation is escalated and auto-assigned to an agent (Story 17's
  pickAndClaimAgentForConversation), that agent gets an in-app notification
  ("a chat was assigned to you"), same shape as ticket_assigned.
- When escalation finds no online agent (conversation:no-agent-available),
  every agent/subadmin holding chats:manage plus every admin gets an
  oversight-style notification ("a chat needs an agent"), mirroring
  notifyTicketOversight's ticket_needs_assignment case.
- Notifications appear in the existing bell/notifications UI
  (components/*Nav*, /me/notifications) and link through to the
  conversation, the same way ticket notifications link to /tickets/:id.
- Best-effort side effect, same as createTicketNotification/
  notifyTicketOversight: a DB failure here must never break the escalate
  socket handler itself.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| *(e.g. `attachments/flow.png`)* | *(e.g. UX flow)* |

*(Add rows per file. If none, write "None.")*

---

## Dependencies

- **Blocked by / related ids:** live-chat Story 17 (auto-assign an escalated chat) — this story notifies on top of that flow, doesn't change it. Depends on the existing ticket-management notification infrastructure (createTicketNotification, notifyTicketOversight, the Notification model, GET /me/notifications, the bell UI in the nav).
- **Depends on code areas or other stories:** `backend/src/models/Notification.ts` (currently `ticketId: { required: true, ref: "Ticket" }` — no conversation support at all; needs a schema change, e.g. a `parentType`/`parentId` pair or an optional `conversationId`, plus new `NotificationType` values), `backend/src/services/notification.service.ts`, `backend/src/sockets/chat.socket.ts` (the `conversation:escalate` handler — where `pickAndClaimAgentForConversation` succeeds/fails), `backend/src/services/assignment.service.ts` (`pickAndClaimAgentForConversation`'s `chats:manage` permission filter — same permission scope this story's oversight recipients should use).

## Extra notes (optional)

- Discovered as a gap while fixing an unrelated live-chat bug (2026-09-01/02 session): the escalation flow already reverts/claims correctly in the DB, but nothing tells a human. A customer can sit "in queue" indefinitely with no signal reaching anyone who could pick it up, beyond whoever happens to have the chats list open.
- Consider whether this should also push a real-time Socket.io event (not just a DB-backed notification a bell has to be clicked to see) to online agents holding `chats:manage`, given how time-sensitive an escalated chat is — email/DB-only felt too slow for a use case this urgent. Flag the tradeoff explicitly in the plan rather than silently picking one.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - The presence/"someone's already replying" indicator — that's a separate
    intake (`show-which-staff-member-is-already-handling-a-live-chat`).
  - Any notification for ticket events — those already exist and are
    unaffected.
