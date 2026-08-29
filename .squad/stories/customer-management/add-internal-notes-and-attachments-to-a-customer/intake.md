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
- Attachments (ID document + general attachments) show file name, size,
  uploader, and upload date to staff.
- Notes and the staff attachment-management controls (the upload inputs)
  are visible to any agent, admin, or delegated subadmin (holding
  `customers:manage`) who opens that customer's profile.
- A customer viewing their own profile can see their own attachments
  (ID document + general attachments) as a read-only gallery of
  photos/PDFs, on a Step 2 of their own profile form — no notes, no
  upload controls, no other customer's files.
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
- **Depends on `security-admin`'s permission model, which has since been implemented on this branch** (no longer a future story to defer around): `backend/src/middleware/auth.ts`'s `requirePermission`, `backend/src/constants/permissions.ts`'s `customers:manage` key, and the `staffOrDelegatedSubadmin()` helper already defined in `backend/src/routes/customer.routes.ts` (used today by the existing `GET /` roster route and `POST /` create route). The new notes/attachment write routes must reuse that same `requireRole("agent","admin","subadmin") + staffOrDelegatedSubadmin("customers:manage")` pattern — a delegated subadmin with `customers:manage` must be able to add notes/attachments too, not just agent/admin.

## Extra notes (optional)

- `IAttachment.url` already exists on the model but there is no file-upload mechanism anywhere in the codebase yet (no multer, no S3/storage config, nothing in `backend/.env.example` for object storage — confirmed by reading it). This story's acceptance criteria says attachments show "file name, size, uploader, upload date" but the current `IAttachment` interface has NO `size` field — **extend `IAttachment` with a `size` (bytes, `number`) field** populated from the actual uploaded file (`multer`'s `file.size`), not client-supplied, so it can't be spoofed.
- **File-storage decision (made now, not deferred):** local-disk storage via `multer`, saved into `backend/uploads/`. Chosen over cloud object storage (S3/Cloudinary/etc.) because: (a) no cloud credentials exist anywhere in this codebase today (`backend/.env.example` has none), (b) this is explicitly a scoped-down "for now" pass per the user, (c) it adds exactly one new dependency (`multer` + `@types/multer`) with no new env vars, matching the project's current no-cloud-service posture. Add `backend/uploads/` to `.gitignore` — uploaded files are runtime data, not source.
- **Correction — files must NOT be served via unauthenticated `express.static`.** An earlier draft of this story described `app.use("/uploads", express.static(...))`, which would expose every customer's ID document to anyone with the URL, no login required — unacceptable for the most sensitive file this story handles. Instead: a protected download route (e.g. `GET /api/v1/customers/:id/attachments/:attachmentId` for general attachments, and an equivalent for the singular ID document) re-runs the exact same staff-or-self authorization check `GET /:id` already does, then streams the file from disk. `IAttachment.url` (and the response the frontend renders links from) is this protected route's path — **never** a raw filesystem path or a public static URL. The on-disk storage layout is an implementation detail the route alone knows about.
- **Storage filenames are fully opaque, decoupled from client input.** Generate a random/UUID storage identifier server-side for the actual on-disk filename; the client-supplied `file.originalname` is kept only as the display `fileName`, never used to construct a filesystem path. This avoids any path-traversal/collision surface from an attacker-controlled name, without needing per-character sanitization to be perfectly exhaustive.
- **ID-document replacement must be failure-safe, not delete-then-save.** Do not delete the previous on-disk file before the new `idDocument` reference is successfully persisted — a save failure in between would leave the customer with no ID document at all. Order: (1) validate and write the new file to disk, (2) save the new `idDocument` reference to the database, (3) only after that succeeds, best-effort-delete the previous on-disk file (log and continue on failure — never let stale-file cleanup block or undo a successful replacement).
- **ID-document type validation goes one step past the `accept` attribute (already known to be UX-only) and past `multer`'s parsed `file.mimetype` alone** — `mimetype` is still client-supplied request metadata, not verified file content, and ID documents are sensitive enough to warrant a second check. Add a matching file-extension check alongside the `fileFilter`'s mimetype check (both must agree) rather than trusting mimetype in isolation; full magic-byte content-sniffing is a reasonable future hardening but not required for this pass. General attachments stay type-unrestricted, as already scoped — this extra check applies to the ID-document upload only.
- **Attachments are scoped down to exactly two upload controls, not an open-ended attachment system** (per direct user direction, overriding any more general reading of the acceptance criteria's plural "attach files"):
  1. **ID document** — a single-file input, one photo image (`image/*`) or one PDF (`application/pdf`), semantically "the customer's ID document." Single slot: uploading a new one replaces the previous one (delete/overwrite the old stored file and its `IAttachment` sub-document, don't accumulate multiple "ID" entries). Represent this as a distinguishable attachment (e.g. a `kind: "id" | "general"` field added to `IAttachment`, or a dedicated `idDocument?: IAttachment` field alongside the existing `attachments: IAttachment[]` array — planner should pick one and justify it, but the two upload paths must stay semantically distinct in the schema, not just in the UI).
  2. **General attachments** — a separate multi-file input, no type restriction, appends to the plural `attachments: IAttachment[]` array (no replace-on-upload behavior — this one accumulates).
  Validate both file type (server-side, not just the HTML `accept` attribute — `accept` is a UX hint, trivially bypassed) and a reasonable size cap (planner should pick and state one, e.g. 10MB) via multer's `fileFilter`/`limits`.
- **Frontend: restructure the existing customer-profile edit page into a 2-step form**, not a net-new page. `frontend/app/customers/[id]/CustomerProfileForm.tsx` (already built, Story 4) currently renders name/email/phone as a single-step form — this becomes **Step 1** unchanged in content. **Step 2** (new) holds: the internal-notes list + add-note input, the ID-document single-file input, and the general multi-file input. Reuse `frontend/components/StepIndicator.tsx` (already built this session — numbered horizontal/vertical stepper, success-checkmark on completed steps, primary-filled circle on current) for the step UI; do not build a new stepper visual. Step 1's fields remain a single Server Action submission (`updateProfile`, unchanged Story 4 behavior) — Step 2 is staff-only (agent/admin), so a customer viewing their own profile only ever sees Step 1 (or the stepper should simply not render Step 2 for a self-viewing customer). Notes/attachments submission is separate Server Action(s) hitting the new `POST /:id/notes` / `POST /:id/attachments` endpoints — don't try to cram file uploads into the existing `updateProfile` JSON-body action; a multipart form needs its own action/route.
- Internal notes: staff can add a free-text note (`POST /:id/notes`, body `{ text }`), sees a chronological list of prior notes with author name (resolve `authorId` → name server-side, don't make the client join it) and timestamp. No edit/delete (see Out of scope).
- **Notes are never visible to the customer** — enforce this at the API level: any endpoint a customer can call to view their OWN profile (Story 4/5) must never include `internalNotes` in the response; only staff-facing responses return it. This must not regress Story 4's existing `GET /:id` / `PATCH /:id` behavior for the fields already working today (name/email/phone/preferredLanguage) — `toProfileResponse()` gains conditional fields, it doesn't lose or restructure existing ones.
- **Attachments, revised — visible to the customer too, but read-only:** unlike notes, the ID document and general attachments ARE returned to a customer viewing their own profile. The frontend renders them differently by audience: staff get the editable notes/upload panel (Step 2, "Internal"); a self-viewing customer gets a read-only gallery of photos/PDFs (Step 2, "Documents") — thumbnails for images, a PDF tile for PDFs, no upload controls, no uploader/note content beyond file name and upload date. A customer must never see another customer's attachments (already enforced by the existing self/staff-only access check on `GET /:id`).
- **Customer's own profile also becomes a 2-step stepper**, not single-step as originally scoped — matching the staff edit form's structure (as agreed): Step 1 is unchanged for everyone; Step 2's *content* is what differs by viewer (editable notes/uploads for staff vs. read-only gallery for a self-viewing customer), reusing the same `StepIndicator`.
- **Pre-existing gap to close while this story is already touching this logic:** `GET /:id` and `PATCH /:id` in `backend/src/routes/customer.routes.ts` currently compute `isStaff = role === "agent" || role === "admin"` inline — a `subadmin` gets a flat 403 today even with `customers:manage` granted, because those two routes were never updated for the security-admin permission model (only the roster `GET /` and create `POST /` routes were). Since a delegated subadmin needs to view/edit a profile before they can add notes/attachments to it, extend that inline check to also admit `subadmin` holding `customers:manage` (via the exported `hasPermission()` helper).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- **Do not use plain `requireRole("agent", "admin")`** — the security-admin permission model is already implemented on this branch (see Dependencies above). New write routes (`POST /:id/notes`, `POST /:id/attachments`, `PUT /:id/id-document`) use `requireAuth, requireRole("agent","admin","subadmin"), staffOrDelegatedSubadmin("customers:manage")` — the same pattern the existing `GET /` and `POST /` routes in `customer.routes.ts` already use.
- New dependency: `multer` + `@types/multer` (backend only). Check `npm view multer version` / `npm view multer dist-tags --json` and `npm view multer@<version> peerDependencies engines --json` against the installed Node before pinning, per `CLAUDE.md`'s dependency-freshness policy.
- File serving: **not** `express.static` — an authenticated, per-file route in `customer.routes.ts` that re-checks the same staff-or-self authorization as `GET /:id` before streaming the file from disk. See Extra notes for why.
- Reuse `frontend/components/StepIndicator.tsx` for the 2-step profile page — do not invent a new stepper component.

## Out of scope

- Cloud object storage (S3/Cloudinary/etc.) — local-disk storage via `multer` is the decision for this pass (see Extra notes). Revisit only if a later story needs multi-instance/horizontally-scaled file serving.
- Editing/deleting existing notes — the acceptance criteria only describes adding notes and attachments, not editing or removing them.
- Editing/removing individual general attachments once uploaded, beyond the ID document's single-slot replace behavior described above.
