import express, { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth";
import { User, IUser, IAttachment } from "../models/User";
import { hasPermission } from "../services/permissions";
import { isValidPhone } from "../utils/phone";
import { uploadIdDocument, uploadGeneralAttachments, customerFilePath } from "../middleware/upload";
import fs from "fs";

// security-admin Story 46: agent/admin access to the roster and creation
// endpoints below is UNCHANGED from before this story — only the
// newly-added subadmin role is actually gated on a permission, so a
// delegated sub-admin gets exactly customers:manage, nothing more. This is
// not `requireRole("agent","admin","subadmin"), requirePermission(...)`
// composed as two chained middlewares, because that would also gate agent
// (whose default permission set does not include customers:manage) —
// see .squad/plans/security-admin/09-story-configure-roles-and-permissions.md
// Task 4 for why that naive conversion is a regression.
function staffOrDelegatedSubadmin(key: Parameters<typeof requirePermission>[0]) {
  return (req: Request, res: Response, next: import("express").NextFunction) => {
    if (req.user!.role === "subadmin") {
      requirePermission(key)(req, res, next);
      return;
    }
    next();
  };
}

const router = express.Router();

const BCRYPT_SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
const NOTE_MAX_LENGTH = 4000;

// Fields safely editable via this endpoint (Story 4).
// role / isActive / passwordHash / internalNotes / attachments are intentionally
// excluded — see USER_STORIES.md customer-management Story 4 and Story 7.
const EDITABLE_FIELDS = ["name", "email", "phone", "preferredLanguage"] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

// Shared by GET/PATCH /:id and the two protected download routes (Story 7) —
// a single definition so the "who can see a customer's full profile" rule
// can't drift between call sites. Same scope as the roster (GET /): a
// sub-admin needs the same customers:manage delegation the list itself
// requires.
async function isFullStaffViewer(caller: { id: string; role: string }): Promise<boolean> {
  return (
    caller.role === "admin" ||
    caller.role === "agent" ||
    (caller.role === "subadmin" && (await hasPermission(caller.id, "customers:manage")))
  );
}

interface HydratedPerson {
  id: string;
  name: string;
}

async function hydratePeople(ids: (Types.ObjectId | undefined)[]): Promise<Map<string, HydratedPerson>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is Types.ObjectId => Boolean(id)).map((id) => String(id))));
  if (uniqueIds.length === 0) return new Map();
  const people = await User.find({ _id: { $in: uniqueIds } }, { name: 1 });
  return new Map(people.map((p) => [String(p._id), { id: String(p._id), name: p.name }]));
}

function hydrateAttachment(attachment: IAttachment, people: Map<string, HydratedPerson>) {
  return {
    id: String(attachment._id),
    fileName: attachment.fileName,
    // Tolerates attachments saved before `size` existed (see Migration notes).
    size: attachment.size ?? null,
    url: attachment.url,
    uploadedAt: attachment.createdAt,
    uploader: attachment.uploadedBy ? (people.get(String(attachment.uploadedBy)) ?? null) : null,
  };
}

// `includeNotes`/`includeAttachments` are independent — notes are staff-only,
// attachments/idDocument are staff-or-self (Story 7). When a flag is false
// its key is omitted entirely (not null/[]), never leaking to a viewer who
// shouldn't even know the field exists.
async function toProfileResponse(user: IUser, opts: { includeNotes: boolean; includeAttachments: boolean }) {
  const base = {
    id: user.id,
    name: user.name,
    email: user.email,
    membershipNumber: user.membershipNumber,
    phone: user.phone ?? null,
    role: user.role,
    preferredLanguage: user.preferredLanguage,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    isActive: user.isActive,
    // See customer-management Story 6 (view-customer-interaction-history). URL shape only.
    ticketHistoryUrl: `/api/v1/customers/${user.id}/history`,
  };

  if (!opts.includeNotes && !opts.includeAttachments) {
    return base;
  }

  const peopleIds: (Types.ObjectId | undefined)[] = [];
  if (opts.includeNotes) peopleIds.push(...user.internalNotes.map((note) => note.authorId));
  if (opts.includeAttachments) {
    peopleIds.push(...user.attachments.map((attachment) => attachment.uploadedBy));
    peopleIds.push(user.idDocument?.uploadedBy);
  }
  const people = await hydratePeople(peopleIds);

  return {
    ...base,
    ...(opts.includeNotes && {
      internalNotes: [...user.internalNotes]
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
        .map((note) => ({
          id: String(note._id),
          text: note.text,
          createdAt: note.createdAt,
          author: note.authorId ? (people.get(String(note.authorId)) ?? null) : null,
        })),
    }),
    ...(opts.includeAttachments && {
      attachments: [...user.attachments]
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
        .map((attachment) => hydrateAttachment(attachment, people)),
      idDocument: user.idDocument ? hydrateAttachment(user.idDocument, people) : null,
    }),
  };
}

// Not part of any story in USER_STORIES.md — Story 4's own plan explicitly
// flagged this as a gap ("no list/search endpoint... do not invent one
// speculatively") and deferred it. Added at the user's direct request.
// Staff-only: this is a customer roster, not the agent/admin account list
// that Story 45 (security-admin) will own separately.
router.get(
  "/",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  staffOrDelegatedSubadmin("customers:manage"),
  async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const filter = { role: "customer" as const };

  const [customers, total] = await Promise.all([
    User.find(filter)
      .select("name email membershipNumber phone isActive createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      membershipNumber: c.membershipNumber,
      phone: c.phone ?? null,
      isActive: c.isActive,
      createdAt: c.createdAt,
    })),
    total,
    page,
    limit,
  });
});

interface CreateCustomerBody {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
}

// USER_STORIES.md customer-management Story 55 ("Add a customer account (as
// staff)") — staff-created customer, initial password set directly (no
// invite-email flow yet). Mirrors auth.routes.ts's /register validation, but
// role is always "customer" here too — staff cannot use this to create an
// agent/admin account (that's Story 45, security-admin, a separate endpoint).
router.post(
  "/",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  staffOrDelegatedSubadmin("customers:manage"),
  async (req: Request<unknown, unknown, CreateCustomerBody>, res: Response) => {
    const { name, email, password, phone } = req.body ?? {};

    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email, and password are required" });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }
    if (phone !== undefined && phone.trim() !== "" && !isValidPhone(phone.trim())) {
      res.status(400).json({ error: "phone must be a valid phone number" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    let user;
    try {
      user = await User.create({
        name,
        email: normalizedEmail,
        passwordHash,
        role: "customer",
        phone: phone?.trim() || undefined,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }
      throw err;
    }

    res.status(201).json(await toProfileResponse(user, { includeNotes: false, includeAttachments: false }));
  }
);

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  // internalNotes/attachments/idDocument ARE loaded here (Story 7) — what's
  // actually exposed in the response is decided by toProfileResponse's
  // includeNotes/includeAttachments flags below, not by what's fetched.
  const user = await User.findById(req.params.id).select("-passwordHash");
  if (!user) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  // Same access scope as the roster (GET /) — a sub-admin who can see the
  // list via a customers:manage delegation can also open what's in it; one
  // couldn't see the list at all without the other, so this was a gap
  // rather than a deliberate narrower boundary.
  const isFullStaff = await isFullStaffViewer(req.user!);
  const isSelf = req.user!.id === String(user._id);
  if (!isFullStaff && !isSelf) {
    res.status(403).json({ error: "You do not have permission to perform this action" });
    return;
  }

  // includeAttachments is unconditionally true here: this line is only ever
  // reached for isFullStaff || isSelf, both of whom are allowed to see the
  // customer's own files — only internalNotes narrows further to staff.
  res.status(200).json(await toProfileResponse(user, { includeNotes: isFullStaff, includeAttachments: true }));
});

router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const isSelf = req.user!.id === String(user._id);
  const isFullStaff = await isFullStaffViewer(req.user!);
  if (!isSelf && !(isFullStaff && user.role === "customer")) {
    res.status(403).json({ error: "You do not have permission to perform this action" });
    return;
  }

  const body = req.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    res.status(400).json({ error: "Request body must be a JSON object" });
    return;
  }

  const bodyKeys = Object.keys(body);
  const unknownKey = bodyKeys.find((key) => !EDITABLE_FIELDS.includes(key as EditableField));
  if (unknownKey) {
    res.status(400).json({ error: `Field ${unknownKey} is not editable` });
    return;
  }
  if (bodyKeys.length === 0) {
    res.status(400).json({ error: "No editable fields provided" });
    return;
  }

  const updates: Partial<Pick<IUser, EditableField>> = {};

  if ("name" in body) {
    const name = body.name;
    if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 200) {
      res.status(400).json({ error: "name must be a non-empty string" });
      return;
    }
    updates.name = name.trim();
  }

  if ("email" in body) {
    // Story 5 ("Maintain contact details"): a customer changing their OWN
    // email must go through the confirm-then-apply flow at
    // PATCH /api/v1/me/contact, not this immediate-apply endpoint — otherwise
    // this endpoint bypasses that story's entire confirmation flow. Staff
    // editing a *different* customer's record (isSelf === false here) is a
    // different trust boundary and keeps immediate-apply.
    if (isSelf) {
      res.status(400).json({
        error: "Update your email from account settings (PATCH /api/v1/me/contact) — it requires confirmation",
      });
      return;
    }
    const email = body.email;
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "valid email is required" });
      return;
    }
    updates.email = email.toLowerCase().trim();
  }

  if ("phone" in body) {
    const phone = body.phone;
    if (phone !== null && typeof phone !== "string") {
      res.status(400).json({ error: "phone must be a string or null" });
      return;
    }
    const trimmed = phone === null ? "" : phone.trim();
    if (trimmed !== "" && !isValidPhone(trimmed)) {
      res.status(400).json({ error: "phone must be a valid phone number" });
      return;
    }
    updates.phone = trimmed === "" ? undefined : trimmed;
  }

  if ("preferredLanguage" in body) {
    const preferredLanguage = body.preferredLanguage;
    if (preferredLanguage !== "en" && preferredLanguage !== "ar") {
      res.status(400).json({ error: "preferredLanguage must be 'en' or 'ar'" });
      return;
    }
    updates.preferredLanguage = preferredLanguage;
  }

  Object.assign(user, updates);

  try {
    await user.save();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }
    throw err;
  }

  res.status(200).json(await toProfileResponse(user, { includeNotes: isFullStaff, includeAttachments: true }));
});

// Protected file access (Story 7) — deliberately NOT `express.static`, which
// would serve every customer's files (including ID documents) to anyone
// with the URL, no login required. Both routes re-run the exact same
// isFullStaffViewer-or-self check GET /:id uses before touching the disk.
router.get("/:id/attachments/:attachmentId", requireAuth, async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const isSelf = req.user!.id === String(user._id);
  if (!(await isFullStaffViewer(req.user!)) && !isSelf) {
    res.status(403).json({ error: "You do not have permission to perform this action" });
    return;
  }
  const attachment = user.attachments.find((a) => String(a._id) === req.params.attachmentId);
  if (!attachment) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }
  res.download(customerFilePath(user.id, attachment.storageFileName), attachment.fileName, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: "File not found" });
    }
  });
});

router.get("/:id/id-document/file", requireAuth, async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const isSelf = req.user!.id === String(user._id);
  if (!(await isFullStaffViewer(req.user!)) && !isSelf) {
    res.status(403).json({ error: "You do not have permission to perform this action" });
    return;
  }
  if (!user.idDocument) {
    res.status(404).json({ error: "ID document not found" });
    return;
  }
  res.download(customerFilePath(user.id, user.idDocument.storageFileName), user.idDocument.fileName, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: "File not found" });
    }
  });
});

interface AddNoteBody {
  text?: string;
}

// Staff-only writes (Story 7) — customers never reach these (requireRole
// excludes "customer" outright), matching "notes/attachments are added by
// staff about a customer," never by the customer themselves.
router.post(
  "/:id/notes",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  staffOrDelegatedSubadmin("customers:manage"),
  async (req: Request<{ id: string }, unknown, AddNoteBody>, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "customer") {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const text = req.body?.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "TEXT_REQUIRED" });
      return;
    }
    if (text.trim().length > NOTE_MAX_LENGTH) {
      res.status(400).json({ error: "TEXT_TOO_LONG" });
      return;
    }

    const authorId = new Types.ObjectId(req.user!.id);
    user.internalNotes.push({ _id: new Types.ObjectId(), text: text.trim(), authorId, createdAt: new Date() });
    await user.save();
    const newNote = user.internalNotes[user.internalNotes.length - 1];

    const author = await User.findById(req.user!.id, { name: 1 });
    res.status(201).json({
      id: String(newNote._id),
      text: newNote.text,
      createdAt: newNote.createdAt,
      author: author ? { id: String(author._id), name: author.name } : null,
    });
  }
);

// Edit an existing note's text — any staff who can add a note can also
// correct one, same customers:manage gate. Deliberately no DELETE for notes
// (edit only, by direct instruction) — see attachments below for delete.
router.patch(
  "/:id/notes/:noteId",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  staffOrDelegatedSubadmin("customers:manage"),
  async (req: Request<{ id: string; noteId: string }, unknown, AddNoteBody>, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "customer") {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const note = user.internalNotes.find((n) => String(n._id) === req.params.noteId);
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }

    const text = req.body?.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "TEXT_REQUIRED" });
      return;
    }
    if (text.trim().length > NOTE_MAX_LENGTH) {
      res.status(400).json({ error: "TEXT_TOO_LONG" });
      return;
    }

    note.text = text.trim();
    await user.save();

    const author = note.authorId ? await User.findById(note.authorId, { name: 1 }) : null;
    res.status(200).json({
      id: String(note._id),
      text: note.text,
      createdAt: note.createdAt,
      author: author ? { id: String(author._id), name: author.name } : null,
    });
  }
);

router.post(
  "/:id/attachments",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  staffOrDelegatedSubadmin("customers:manage"),
  uploadGeneralAttachments,
  async (req: Request<{ id: string }>, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "customer") {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "At least one file is required" });
      return;
    }

    const uploadedBy = new Types.ObjectId(req.user!.id);
    const newEntries: IAttachment[] = files.map((file) => {
      const _id = new Types.ObjectId();
      return {
        _id,
        fileName: file.originalname,
        storageFileName: file.filename,
        size: file.size,
        uploadedBy,
        createdAt: new Date(),
        url: `/api/v1/customers/${user.id}/attachments/${_id}`,
      };
    });
    user.attachments.push(...newEntries);
    await user.save();

    const uploader = await User.findById(req.user!.id, { name: 1 });
    const people = uploader ? new Map([[String(uploader._id), { id: String(uploader._id), name: uploader.name }]]) : new Map();
    res.status(201).json(newEntries.map((entry) => hydrateAttachment(entry, people)));
  }
);

// Delete a general attachment — by direct instruction, no separate "edit"
// action (there's no metadata on an attachment worth editing beyond the
// file itself; replacing one is just delete + re-upload). The ID document
// keeps its existing replace-only behavior (PUT below) — this route is for
// the plural `attachments` array only.
router.delete(
  "/:id/attachments/:attachmentId",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  staffOrDelegatedSubadmin("customers:manage"),
  async (req: Request<{ id: string; attachmentId: string }>, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "customer") {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const index = user.attachments.findIndex((a) => String(a._id) === req.params.attachmentId);
    if (index === -1) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    // Remove the DB reference first, then best-effort delete the on-disk
    // file — the reverse of the replace-order reasoning on the ID document
    // below: here, a failure to delete the file just leaves a harmless
    // orphaned file, whereas deleting the file first and then failing to
    // save would leave a reference pointing at nothing.
    const [removed] = user.attachments.splice(index, 1);
    await user.save();

    fs.promises.unlink(customerFilePath(user.id, removed.storageFileName)).catch((err) => {
      console.error("[attachments] failed to remove deleted file (best-effort cleanup)", err);
    });

    res.status(204).send();
  }
);

router.put(
  "/:id/id-document",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  staffOrDelegatedSubadmin("customers:manage"),
  uploadIdDocument,
  async (req: Request<{ id: string }>, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "customer") {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "A file is required" });
      return;
    }

    // Failure-safe replacement: write + validate the new file first (multer
    // already did, by this point), persist the new reference, and only THEN
    // best-effort-delete the previous file. Never delete-then-save — a save
    // failure in between would leave the customer with no ID document at all.
    const previous = user.idDocument;
    const _id = new Types.ObjectId();
    user.idDocument = {
      _id,
      fileName: file.originalname,
      storageFileName: file.filename,
      size: file.size,
      uploadedBy: new Types.ObjectId(req.user!.id),
      createdAt: new Date(),
      url: `/api/v1/customers/${user.id}/id-document/file`,
    };
    await user.save();

    if (previous) {
      fs.promises.unlink(customerFilePath(user.id, previous.storageFileName)).catch((err) => {
        console.error("[id-document] failed to remove previous file (best-effort cleanup)", err);
      });
    }

    const uploader = await User.findById(req.user!.id, { name: 1 });
    const people = uploader ? new Map([[String(uploader._id), { id: String(uploader._id), name: uploader.name }]]) : new Map();
    res.status(200).json(hydrateAttachment(user.idDocument, people));
  }
);

export default router;
