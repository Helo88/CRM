# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/auth/role-based-access-control/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Auth
- **Feature slug (folder under `plans/`):** `auth`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `3` *(Story 3 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `auth`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Role-based access control
```

---

## Description

```
As the system, I want every API endpoint to check the caller's role, so that
customers, agents, and admins can only do what their role allows.
```

---

## Acceptance criteria

```
- Customer-only, agent-only, and admin-only endpoints each reject callers
  with the wrong role.
- Unauthorized/forbidden requests return a clear 401/403 response.
- Role is read from the verified session/JWT, never trusted from client
  input.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 1 (sign-up) and Story 2 (login) — both completed; they issue the JWTs this middleware verifies.
- **Depends on code areas or other stories:** `backend/src/middleware/auth.ts` (`requireAuth`/`requireRole` — ALREADY IMPLEMENTED, predates this being planned through squad-kit), `backend/src/routes/ticket.routes.ts` and `backend/src/routes/conversation.routes.ts` (already apply `requireAuth`/`requireRole` to their stub routes as a usage example).

## Extra notes (optional)

- IMPORTANT: `requireAuth` and `requireRole` in `backend/src/middleware/auth.ts` already exist and are already functionally complete (JWT verification, role attachment to `req.user`, 401 on missing/invalid token, 403 on wrong role) — they were written as part of the initial project scaffold, before any story was run through squad-kit. This story's job is to **verify and document** that the acceptance criteria are actually satisfied by the existing code (and write tests/verification for it), NOT to re-implement the middleware from scratch. If the planner finds a genuine gap against the acceptance criteria, note it precisely; do not assume a gap exists without checking the real code first.
- Every currently-existing protected route (`ticket.routes.ts`, `conversation.routes.ts`) already uses this middleware — treat those as the precedent/pattern for how future protected routes should be written, and confirm they're wired correctly as part of this story's verification.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `req.user` typing is augmented in `backend/src/types/express.d.ts`.

## Out of scope

- Adding role checks to routes that don't exist yet (ticket-management, live-chat, etc. beyond their current stubs) — those get `requireAuth`/`requireRole` applied when THEIR stories are implemented, not this one.
- Fine-grained permissions beyond the three roles (customer/agent/admin) — that's Story 45 (`security-admin` feature), a separate, later feature.
