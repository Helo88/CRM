# Story intake

- Folder: `.squad/stories/ticket-management/in-app-notifications-for-ticket-events/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `54` *(Story 54 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ticket-management`

---

## Title

```
In-app notifications for ticket events
```

---

## Description

```
As an agent, I want to see an in-app notification when a ticket is
assigned or escalated to me, so that I don't have to keep refreshing my
ticket list to notice new work.
```

---

## Acceptance criteria

```
- A visible notification indicator (e.g. a badge/counter in the persistent
  nav) appears when there's an unread ticket-assignment or
  ticket-escalation notification.
- Clicking a notification opens the relevant ticket directly and marks it
  read.
- Notifications are per-agent (an agent only sees notifications for
  tickets assigned/escalated to them) and persist across sessions until
  read.
- This is what actually implements the "assigned agent is notified
  in-app" bullets already written into Story 10 and Story 12 — those
  stories describe the trigger, this story is the mechanism and the UI.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None yet — the notification badge/dropdown wasn't part of the "Ticket Views" mockup pass (that covered the ticket list/detail screens only). Add a screenshot here if one gets made before planning.

---

## Dependencies

- **Blocked by / related ids:** Story 10 (auto-assign) and Story 12 (escalate) are the two triggers this story wires notifications up to — plan/build this story alongside or after those two, since it has nothing to fire on otherwise.
- **Depends on code areas or other stories:** No `Notification` model exists yet in `backend/src/models/` — this story creates one. `frontend/components/SiteHeader.tsx` is the persistent nav where the badge/counter lives, per the project's "no authenticated action only reachable via an ad hoc link" convention.

## Extra notes (optional)

- Both Story 10's and Story 12's intakes explicitly deferred "in-app notification" because no notification model existed at the time they were written — this story is that missing piece. When Story 10/12 are implemented (or re-planned) after this one, they should call into this story's notification-creation function rather than duplicating notification logic.
- Real-time delivery (Socket.io, already used for live-chat) is a nice-to-have for "instant" badges but not required by the acceptance criteria as written — polling/refetch-on-navigation satisfies "persist across sessions until read." Note which one is chosen rather than silently picking the heavier real-time option unprompted.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- New model: `backend/src/models/Notification.ts` — minimal shape: `recipient: Types.ObjectId (ref User)`, `type: "ticket_assigned" | "ticket_escalated"`, `ticketId: Types.ObjectId (ref Ticket)`, `read: boolean (default false)`, timestamps. Index on `{ recipient: 1, read: 1, createdAt: 1 }` for the badge-count query, mirroring `Message.ts`'s existing indexing pattern.
- New endpoints: resolved — mount these as self-scoped routes, `requireAuth` only, no `requirePermission` key. `backend/src/routes/me.routes.ts` already establishes this exact precedent for "my own data" endpoints (`GET /me/status`, `GET/PATCH /me/contact` — all `requireAuth`-only, no permission gate, per current code). "My notifications" is the same shape (every authenticated staff account reads/marks-read only its own notifications, never another user's), so add `GET /me/notifications` (unread-first) and `PATCH /me/notifications/:id/read` there rather than a new top-level `notifications.routes.ts` or inventing a permission key.

## Out of scope

- Live-chat's equivalent notifications (would reuse this same model/mechanism, but wiring that up is `live-chat` feature's own concern, not this story's).
- Email notifications — `email.service.ts` already covers that channel separately; this story is the in-app badge only.
