# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/live-chat/show-which-staff-member-is-already-handling-a-live-chat/intake.md`
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
Show which staff member is already handling a live chat
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As an agent/subadmin/admin, when I open a live chat that another staff
member is already actively viewing or replying in, I want a clear signal
that someone else has it — so I don't step on their reply, even though the
system currently lets any authorized staff member (the assignedAgent, any
admin, any subadmin holding chats:manage) join and message the same
conversation with no visibility into who else is already there.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Whenever more than one staff member is connected to the same
  conversation (both have done conversation:join on it), each sees who
  else is currently present — not just their own view.
- The signal is meaningful, not just a name: e.g. "Sara is already
  replying here" rather than a bare avatar/initial with no context.
- The indicator updates live: it appears when a second staff member joins/
  leaves, without requiring a page refresh.
- Nothing here actually blocks the second staff member from sending a
  message if they choose to — this is a "heads up" signal, not a hard lock
  (the acceptance criteria doesn't require enforcing exclusivity, only
  making it visible enough that no one does it by accident).
- When a staff member (agent/subadmin/admin — never the customer) joins or
  leaves a conversation that has a ticket opened from it
  (Ticket.sourceConversation === this conversation's id, set by Story 62's
  "open a ticket" flow), that join/leave is recorded as an event in that
  ticket's history timeline (Story 13's aggregator), alongside status/
  category/priority/assignee changes and replies.
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

- **Blocked by / related ids:** live-chat Story 18 (agent/admin replies in real time) — that's the handler this story adds presence tracking alongside. Related to the sibling intake `notify-available-agents-when-a-chat-needs-a-human` (that one is "tell someone a chat needs picking up"; this one is "tell staff who's already IN a chat") — separate concerns, don't conflate them in one plan.
- **Depends on code areas or other stories:** `backend/src/sockets/chat.socket.ts` (`isAuthorizedOnConversation` — customer, assignedAgent, any admin, or a subadmin holding `chats:manage` can all join/message the same conversation today; the `conversation:join`/`conversation:message` handlers have no concept of "who else is in this room"), Socket.io's own room membership (`io.sockets.adapter.rooms.get(\`conversation:${id}\`)` or a small in-memory/DB-backed presence map) is the natural mechanism to build on. For the ticket-history addition: `backend/src/models/Ticket.ts` (`sourceConversation: Types.ObjectId | null`, already set by Story 62's create-ticket-from-conversation flow — the link this criterion needs already exists, nothing new to model there), `backend/src/services/ticketHistory.service.ts` (`TicketHistoryEventKind`/`buildTicketHistory` — add a new kind, e.g. `chat_participant_joined`/`chat_participant_left`, following the exact same shape as the four existing *History arrays on Ticket), `frontend/app/tickets/[id]/TicketDetailSidebar.tsx` (`HISTORY_EVENT_ICON`, `historyEventLabel` — needs an icon + i18n label for the new kind(s), same pattern as the other seven).

## Extra notes (optional)

- Discovered as a gap in the same session as the sibling notify-agents story: nothing today distinguishes "the assigned agent is here" from "an admin who also has access happened to open this chat" — the socket layer treats every authorized joiner identically.
- Needs a decision on where this surfaces: inside the chat panel itself (agent-workspace's chat view — not yet located/built as of this intake) and/or in whatever list surfaces live chats to staff (a "being handled by X" badge per row, similar in spirit to the ticket list's "Assigned to" column). Flag this as a planning decision rather than assuming one.
- Must exclude the conversation's own customer from "staff present" — this is a staff-to-staff signal only, never shown to or triggered by the customer.
- The ticket-history criterion only applies when a ticket actually exists with `sourceConversation` pointing at this conversation — most live chats never spawn a ticket (Story 62's suggestion is declinable), so this is the exception path, not the common one. Only a **staff** member's join/leave should be recorded — the customer's own join, and reconnect flicker from a flaky connection, would just be noise in the ticket's timeline. Whether a "leave" is even a reliable, well-defined event (a clean `conversation:leave` vs. an unclean `disconnect`, and whether a leave within a few seconds of a join should just be suppressed rather than always logged) is itself part of what this story needs to design, alongside the presence indicator's own join/leave detection — the two features share the same underlying detection mechanism, don't build it twice.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Hard-blocking a second staff member from replying (see acceptance
    criteria — this is a visibility signal, not an enforced lock).
  - The "notify agents when a chat needs a human" story — separate intake.
