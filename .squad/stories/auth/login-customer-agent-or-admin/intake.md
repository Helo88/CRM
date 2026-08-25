# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/auth/login-customer-agent-or-admin/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Auth
- **Feature slug (folder under `plans/`):** `auth`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `2` *(Story 2 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `auth`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Login (customer, agent, or admin)
```

---

## Description

```
As a registered user, I want to log in with my email and password, so that I
can access the features for my role.
```

---

## Acceptance criteria

```
- Invalid credentials return a generic error (doesn't reveal which field was
  wrong).
- A successful login returns a session/JWT encoding the user's role.
- Sessions/tokens expire after a configurable time and require re-login.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 1 (customer sign-up) — completed. This story's `POST /login` sits in the same router file (`backend/src/routes/auth.routes.ts`) that Story 1 already implements `POST /register` in, and reuses the `JwtPayload` type Story 1 exported from `backend/src/middleware/auth.ts`.
- **Depends on code areas or other stories:** `backend/src/routes/auth.routes.ts` (currently has a working `POST /register` and a `POST /login` 501 stub — this story implements the stub), `backend/src/middleware/auth.ts` (exports `JwtPayload`, already used by `requireAuth`), `backend/src/models/User.ts` (`passwordHash`, `role`, `isActive` fields).

## Extra notes (optional)

- Login must work for ALL roles (customer, agent, admin) — it is one shared endpoint, not split per role. Role is read from the stored `User.role` field, never supplied by the client.
- "Generic error" means the same error message and status code for both a nonexistent email and a wrong password — do not let the response distinguish which one was wrong (this prevents email enumeration).
- An inactive/deactivated account (`User.isActive === false`, used later by Story 44) must not be able to log in — treat it the same as invalid credentials.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Compare the submitted password against `User.passwordHash` with `bcryptjs`'s `compare`.
- Sign the JWT the same way Story 1 does (reuse the pattern, don't reinvent it) — same `JWT_SECRET`/`JWT_EXPIRES_IN` env vars, same `JwtPayload` shape `{ sub, role }`.

## Out of scope

- Sign-up (Story 1, already implemented).
- Role-based access control middleware behavior (Story 3 — already implemented in `requireAuth`/`requireRole`, this story only issues a token those functions can already verify).
- Refresh tokens / "remember me" — not in the acceptance criteria, don't add it.
