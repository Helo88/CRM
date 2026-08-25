# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/customer-management/add-internal-notes-and-attachments-to-a-customer/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Customer Management
- **Feature slug (folder under `plans/`):** `customer-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `7` *(Story 7 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `customer-management`

---

## Title

```
Add internal notes and attachments to a customer
```

---

## Description

```
As an agent or admin, I want to add internal notes and attach files to a
customer's profile, so that the team keeps shared context and supporting
documents in one place.
```

---

## Acceptance criteria

```
- Notes are internal-only and never visible to the customer.
- Attachments show file name, size, uploader, and upload date.
- Notes/attachments are visible to any agent or admin who opens that
  customer's profile.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 4 (customer profile) — notes/attachments render as part of that profile view.
- **Depends on code areas or other stories:** `backend/src/models/User.ts` — `internalNotes: IInternalNote[]` and `attachments: IAttachment[]` sub-document arrays ALREADY EXIST on the schema (`internalNoteSchema`/`attachmentSchema`, with `text`/`authorId`/`createdAt` and `fileName`/`url`/`uploadedBy`/`createdAt` respectively) — this story is largely about exposing read/write endpoints for fields that are already modeled, not adding new schema.

## Extra notes (optional)

- `IAttachment.url` already exists on the model but there is no file-upload mechanism anywhere in the codebase yet (no multer, no S3/storage config, nothing in `backend/.env.example` for object storage). This story's acceptance criteria says attachments show "file name, size, uploader, upload date" but the current `IAttachment` interface has NO `size` field — flag this as a gap: either extend the interface with a `size` (bytes) field, or note that "size" must come from wherever the actual file upload is handled (which doesn't exist yet). Don't invent a full file-storage subsystem un-scoped — if a real upload mechanism is out of reach for this story, the planner should implement note/attachment-metadata CRUD against fields the client already has available (e.g. accept a pre-hosted `url` + `fileName` + `size` from the client, deferring actual file hosting to a later story) and say so explicitly rather than silently skipping "size".
- **Never visible to the customer** — enforce this at the API level: any endpoint a customer can call to view their OWN profile (Story 4/5) must never include `internalNotes`/`attachments` in the response; only agent/admin-facing endpoints return them.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- `requireRole("agent", "admin")` for both writing and reading notes/attachments.

## Out of scope

- Actual file storage/hosting infrastructure (S3, local disk, etc.) if not already decided — flag as a gap per Extra Notes rather than building infra unprompted.
- Editing/deleting existing notes — the acceptance criteria only describes adding notes and attachments, not editing or removing them.
