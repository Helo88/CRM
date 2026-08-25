# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/customer-management/maintain-contact-details/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Customer Management
- **Feature slug (folder under `plans/`):** `customer-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `5` *(Story 5 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `customer-management`

---

## Title

```
Maintain contact details
```

---

## Description

```
As a customer, I want to keep my email and phone number up to date, so that
support can reach me and my replies go to the right place.
```

---

## Acceptance criteria

```
- Customer can update their own contact details from account settings.
- Changing the account email requires confirming the new address before it
  takes effect.
- Contact detail changes are reflected immediately in any new outbound
  emails.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 4 (view/edit customer profile) — same resource, this story is the self-service subset of it plus the email-confirmation flow. Story 1-3 (auth) for `requireAuth`.
- **Depends on code areas or other stories:** `backend/src/models/User.ts` (`email`, `phone` fields), `backend/src/services/email.service.ts` (`sendEmail` — the only place SMTP is touched, per CLAUDE.md's service-layer rule; use it for the confirmation email, don't call nodemailer directly from a route).

## Extra notes (optional)

- Email change is NOT immediate — it requires a confirmation step before the new email takes effect (the acceptance criteria explicitly says so). This likely needs a way to store a pending-email + confirmation token and a confirm endpoint/link. Phone number changes, by contrast, are immediate (no confirmation mentioned in the acceptance criteria) — don't require confirmation for phone.
- "Reflected immediately in any new outbound emails" just means: once the (confirmed) email is updated on the `User` document, any code path that later calls `sendEmail` for that user must read the current `email` field, not a stale cached copy — this is naturally true if outbound email always re-reads `User.email` at send time; call this out in Edge Cases if there's any risk of a cached/stale reference.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Gemini API key and SMTP credentials are backend-only env vars (`backend/.env.example`) — nothing here touches the frontend directly beyond a settings form (out of scope for this story unless the planner judges a minimal one necessary to satisfy "from account settings").

## Out of scope

- Agent/admin editing a customer's contact details on their behalf — that's Story 4, already covers agent/admin edits.
- Password change — not mentioned in this story's acceptance criteria.
