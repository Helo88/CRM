# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/auth/customer-sign-up/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Auth
- **Feature slug (folder under `plans/`):** `auth`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `1` *(Story 1 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `auth`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Customer sign-up
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
As a visitor, I want to create an account with my name, email, and password,
so that I can access customer support and have my conversations tied to my
identity.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Passwords are hashed before storage (e.g. bcrypt); duplicate emails are
  rejected with a clear error.
- On success, the customer is logged in automatically (session/JWT issued).
- A customer profile record is created automatically alongside the account
  (feeds `customer-management`). Note: there is no separate CustomerProfile
  collection yet — the User document itself IS the profile record (see
  backend/src/models/User.ts), so creating the User row satisfies this.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** None — this is the first story in the build order (see CLAUDE.md "Recommended build order").
- **Depends on code areas or other stories:** `backend/src/models/User.ts` (already modeled: name/email/passwordHash/role/phone/preferredLanguage/isActive), `backend/src/routes/auth.routes.ts` (currently a 501 stub for POST /register — this story implements it).

## Extra notes (optional)

- This intake covers ONLY Story 1 (sign-up). Story 2 (login) and Story 3 (role-based access control) are separate stories in the same `auth` feature — plan/implement them separately. Story 3's RBAC middleware (`requireAuth`/`requireRole` in `backend/src/middleware/auth.ts`) already exists as a working stub (JWT verify + role check) and expects a JWT payload shaped `{ sub: string, role: UserRole }` — the token this story issues on sign-up must match that shape so Story 2/3 work don't need to change it.
- Self-service `/register` must always create the account with role `"customer"`, ignoring any `role` field the client might send — agent/admin accounts are created by an admin later (Story 44), not through this endpoint.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Backend: Node/Express (TS), Mongoose. Endpoint: `POST /api/v1/auth/register`, mounted in `backend/src/app.ts` at `/api/v1/auth` (already wired to the stub router).
- Hash passwords with `bcryptjs` (already a backend dependency). Issue a JWT with `jsonwebtoken` (already a dependency) — see `backend/src/middleware/auth.ts` for the expected payload shape (`{ sub, role }`) and `JWT_SECRET`/`JWT_EXPIRES_IN` env vars (already in `backend/.env.example`).
- Per CLAUDE.md conventions: `strict` TS, no `any`, async/await throughout, explicit request/response interfaces.
- Env vars already defined in `backend/.env.example`: `JWT_SECRET`, `JWT_EXPIRES_IN`.

## Out of scope

- Login (Story 2) and its own intake/plan.
- Role-based access control middleware (Story 3) — already implemented as a working stub, not part of this story.
- Any customer-management profile editing (Stories 4-7) beyond creating the initial User record.
- Email confirmation flows (that's Story 5, contact-detail changes, a later feature).
