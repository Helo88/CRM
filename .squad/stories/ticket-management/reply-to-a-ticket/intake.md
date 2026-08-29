# Story intake

- Folder: `.squad/stories/ticket-management/reply-to-a-ticket/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `56` *(Story 56 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `ticket-management`

---

## Title

```
Reply to a ticket
```

---

## Description

```
As a human agent, I want to write a reply to a ticket, so that the
customer gets an answer delivered the way they submitted their issue — by
email.
```

---

## Acceptance criteria

```
- Reply is emailed to the customer's address on file and also stored on
  the ticket, so it's visible in-app (Story 36) and in its history (Story
  13).
- Agent can attach files to a reply, same as a customer can when
  submitting (Story 8).
- Sending a reply moves the ticket to "Answered" (Story 11) unless the
  agent has already closed it.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| `attachments/agent-detail-thread.png` | The ticket detail thread view — customer's original message bubble, the internal-note bubble (dashed amber, agent-only), and the agent's reply bubble labeled "Sent by email" — plus the reply composer at the bottom. From the approved "Ticket Views" mockup, agent persona, detail mode. |
| `attachments/customer-detail-readonly.png` | The customer's own read-only view of the same thread, for contrast — shows there's no reply box on their side. |

*(Both screenshots are in place under `attachments/`.)*

---

## Dependencies

- **Blocked by / related ids:** Story 8 (submit a ticket) — a ticket and its opening message must exist first. Story 11 (update ticket status) — this story triggers the "New/In Progress → Answered" transition; build or coordinate with whichever lands first, since one calls into the other either way. Story 36 (`customer-portal`, "Track ticket status from the portal") and Story 13 (view full ticket history) are downstream consumers of the reply data this story creates, not blockers.
- **Depends on code areas or other stories:** `backend/src/models/Message.ts` — **already exists and is the right model for this**: `parentType: "ticket"`, `parentId: <ticket id>`, `senderType: "agent"`, `senderId: <agent id>`, `internal: false`, `attachments: IMessageAttachment[]`, already indexed on `{ parentType, parentId, createdAt }`. This story does NOT need a new model, just a new endpoint that creates a `Message` and triggers email. `backend/src/services/email.service.ts` (the actual send — never call SMTP directly from the route, per CLAUDE.md's service-layer rule). `backend/src/middleware/upload.ts` is the existing attachment-upload pattern (currently scoped to customer profile attachments under `uploads/customers/<id>/`) — this story's reply attachments need an equivalent, ticket-scoped storage path/multer config, not a reuse of the customer one as-is.

## Extra notes (optional)

- `Message.internal` is what separates this story's customer-facing reply (`internal: false`) from `agent-workspace` Story 24's internal notes (`internal: true`) — both are the same model, same endpoint family, different flag. If Story 24 is planned before this one, extend its endpoint rather than building a parallel one; if this story is planned first, build the endpoint generically enough (`internal` as a body param, defaulting appropriately per which UI called it) that Story 24 can reuse it instead of forking a second reply-creation path.
- The mockup's agent detail view also shows editable Status/Category/Priority selects and an internal-note bubble in the same panel — those belong to Stories 11, 9, and `agent-workspace` Story 24 respectively, not this story. This story is specifically the reply composer + send action + the automatic status flip to "Answered."

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- New permission key `tickets:reply` in `backend/src/constants/permissions.ts`'s `PERMISSION_KEYS`, added to `DEFAULT_PERMISSIONS_BY_ROLE.agent` (day-to-day action), not to `SUBADMIN_ONLY_PERMISSIONS`. Gate the new endpoint with `requirePermission("tickets:reply")` per `[[feedback_every_route_needs_permission]]`.
- New endpoint, e.g. `POST /api/v1/tickets/:id/messages` (body: `text`, optional `attachments`, `internal: false` for this story's use) — creates the `Message`, then: (a) calls `email.service.ts` to send it to `Ticket.customer`'s email, (b) if current status isn't `"closed"`, sets `Ticket.status = "answered"`.

## Out of scope

- Internal notes (`internal: true` on the same model) — `agent-workspace` Story 24, though likely the same underlying endpoint with a different flag (see Extra notes).
- The customer replying back into an already-open ticket — not in the backlog (Story 36 only covers the customer *viewing* the thread read-only; the mockup's customer detail view explicitly calls this out).
- Editable status/category/priority controls shown alongside the composer in the mockup (Stories 11, 9).
