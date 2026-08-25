# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/customer-management/view-and-edit-a-customer-profile/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Customer Management
- **Feature slug (folder under `plans/`):** `customer-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `4` *(Story 4 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `customer-management`

---

## Title

```
View and edit a customer profile
```

---

## Description

```
As an agent or admin, I want to view and edit a customer's profile details,
so that I have accurate information about who I'm helping.
```

---

## Acceptance criteria

```
- Profile shows name, email, phone (optional), and account creation date.
- Agent/admin can edit profile fields; the customer can edit their own basic
  details from their account settings.
- Every profile links out to that customer's full ticket/chat history
  (Story 6).
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 1-3 (auth) — completed; this story needs `requireAuth`/`requireRole` to restrict edit access.
- **Depends on code areas or other stories:** `backend/src/models/User.ts` (the customer "profile" IS the `User` document — there is no separate `CustomerProfile` collection; fields `name`, `email`, `phone`, `createdAt` already exist on the schema), `backend/src/middleware/auth.ts` (`requireAuth`, `requireRole`).

## Extra notes (optional)

- There is no dedicated customers route file yet — decide whether to create `backend/src/routes/customer.routes.ts` (mounted at `/api/v1/customers` in `backend/src/app.ts`, following the existing pattern of `ticket.routes.ts`/`conversation.routes.ts`) rather than bolting this onto an unrelated router.
- Two distinct permission levels on the same resource: an agent/admin can edit ANY customer's profile fields; a customer can only edit their OWN basic details. Both need `requireAuth`; only the agent/admin path also needs `requireRole("agent", "admin")` — a customer editing their own record should be allowed by an ownership check (`req.user.id === target user id`), not a role check.
- "Links out to full ticket/chat history" only needs to reference Story 6's endpoint/UI by shape — Story 6 is a separate story and not yet implemented; don't block this story on it, just don't contradict its design.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- REST convention per CLAUDE.md: versioned under `/api/v1/...`, grouped by resource (`/customers`).

## Out of scope

- Ticket/chat history timeline itself (Story 6, separate story).
- Internal notes and attachments (Story 7, separate story).
- Contact-detail email-change confirmation flow (Story 5, separate story).
