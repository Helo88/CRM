# customer-management — plan overview

Entry point for the **customer-management** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 04 | `04-story-view-and-edit-a-customer-profile.md` | View and edit a customer profile | view-and-edit-a-customer-profile | — |
| 05 | `05-story-maintain-contact-details.md` | Maintain contact details | maintain-contact-details | — |
| 06 | `06-story-view-customer-interaction-history.md` | View customer interaction history | view-customer-interaction-history | — |
| 07 | `07-story-add-internal-notes-and-attachments-to-a-customer.md` | Add internal notes and attachments to a customer | add-internal-notes-and-attachments-to-a-customer | 04 |

## Dependency notes

- **All four stories share one router file, `backend/src/routes/customer.routes.ts`, first created by Story 04.** Stories 05-07 extend it rather than creating their own routers or `app.ts` mounts:
  - Story 04: creates the file, `GET /:id` (mixed staff/self-read gating) + `PATCH /:id`.
  - Story 05: adds `email`-change confirmation via a *separate* router (`me.routes.ts`, `/api/v1/me/...`) — but also **modifies Story 04's `PATCH /:id`** to reject `email` on the customer-self-edit path, closing a bypass of its own confirmation flow.
  - Story 06: adds `GET /:id/history` to the same `customer.routes.ts` file.
  - Story 07: modifies Story 04's `GET /:id` serializer (`toProfileResponse`) to conditionally include `internalNotes`/`attachments` for staff viewers only, and adds two new staff-only `POST /:id/notes` / `POST /:id/attachments` routes to the same file.
- Execute in `NN` order (04 → 05 → 06 → 07) — each later story's plan assumes the prior ones' code already exists in this shared file.
