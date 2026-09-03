import express, { Request, Response } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { AuditLog } from "../models/AuditLog";
import { User } from "../models/User";
import { listAuditLogsQuerySchema } from "../validation/audit.schema";
import { escapeRegex } from "../utils/regex";

const router = express.Router();

interface PopulatedActor {
  _id: unknown;
  name: string;
  email: string;
  role: string;
}

function isPopulatedActor(actor: unknown): actor is PopulatedActor {
  return Boolean(actor) && typeof actor === "object" && "name" in (actor as object);
}

// security-admin Story 47: read-only, filterable audit log — the ONLY route
// this resource exposes (no create/update/delete HTTP surface at all; every
// AuditLog document is written internally via services/auditLog.service.ts).
// Gated on requirePermission("audit:view") — admin always passes, a
// sub-admin needs the key granted, an agent can never hold it (see
// constants/permissions.ts's SUBADMIN_ONLY_PERMISSIONS).
router.get("/", requireAuth, requirePermission("audit:view"), async (req: Request, res: Response) => {
  const parsed = listAuditLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
    return;
  }
  const { page, limit, q, action, category, dateFrom, dateTo } = parsed.data;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (action) filter.action = action;
  if (category) filter.category = category;
  if (dateFrom || dateTo) {
    // Plain-date values (YYYY-MM-DD) parse as UTC midnight via `new Date`,
    // same as ticket.routes.ts's identical createdFrom/createdTo pattern —
    // a `dateTo` of a plain date therefore excludes same-day entries after
    // UTC midnight. Inherited quirk, not fixed here to keep every
    // date-range filter in the app behaving consistently.
    filter.createdAt = {
      ...(dateFrom ? { $gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { $lte: new Date(dateTo) } : {}),
    };
  }

  // `q` searches the RESOLVED actor's name/email — AuditLog.actor is an
  // ObjectId ref, not a denormalized name/email snapshot (see the plan's
  // Product rules), so matching users are looked up first and the audit
  // filter narrows to their ids. An empty match set must still return zero
  // rows, not "filter ignored" — `$in: []` does this correctly in Mongo.
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    const matchingUsers = await User.find({ $or: [{ name: regex }, { email: regex }] }).select("_id");
    filter.actor = { $in: matchingUsers.map((u) => u._id) };
  }

  const [entries, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("actor", "name email role"),
    AuditLog.countDocuments(filter),
  ]);

  // Resolve targetId -> {id,name,email,role} in one extra query, same
  // shape as the populated actor — every targetType this story wires is
  // "User", so this always applies. Keeps the response usable for the
  // frontend's "{actor} updated permissions for {target}"-style lines
  // without a second round trip per row.
  const targetIds = entries.filter((e) => e.targetId).map((e) => e.targetId);
  const targets = targetIds.length
    ? await User.find({ _id: { $in: targetIds } }).select("name email role")
    : [];
  const targetMap = new Map(targets.map((u) => [String(u._id), { id: u.id, name: u.name, email: u.email, role: u.role }]));

  res.status(200).json({
    entries: entries.map((e) => ({
      id: e.id,
      actor: isPopulatedActor(e.actor) ? { id: String(e.actor._id), name: e.actor.name, email: e.actor.email, role: e.actor.role } : null,
      action: e.action,
      category: e.category,
      targetType: e.targetType,
      targetId: e.targetId ? String(e.targetId) : null,
      target: e.targetId ? (targetMap.get(String(e.targetId)) ?? null) : null,
      metadata: e.metadata,
      ipAddress: e.ipAddress,
      createdAt: e.createdAt,
    })),
    total,
    page,
    limit,
  });
});

export default router;
