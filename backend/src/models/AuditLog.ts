import mongoose, { Document, Schema, Types } from "mongoose";

// security-admin Story 47: proof-of-pattern audit trail. Deliberately a
// SEPARATE, narrower mechanism from Ticket.statusHistory (see
// .squad/plans/security-admin/34-story-review-audit-logs.md's Prerequisites
// section for why that embedded array isn't migrated here) — any future
// consolidation should converge on THIS model, not the other way around.
// Write-only via internal service calls (see services/auditLog.service.ts);
// no create/update/delete HTTP route exists for it at all — the simplest
// possible enforcement of "cannot be edited or deleted by regular users".
export type AuditActionCategory = "auth" | "permissions" | "staff";

export type AuditAction =
  | "login_success"
  | "login_failed"
  | "permissions_changed"
  | "staff_activated"
  | "staff_deactivated";

export const AUDIT_ACTIONS: AuditAction[] = [
  "login_success",
  "login_failed",
  "permissions_changed",
  "staff_activated",
  "staff_deactivated",
];

export const AUDIT_ACTION_CATEGORY: Record<AuditAction, AuditActionCategory> = {
  login_success: "auth",
  login_failed: "auth",
  permissions_changed: "permissions",
  staff_activated: "staff",
  staff_deactivated: "staff",
};

export interface IAuditLog extends Document {
  // Null when the action couldn't be tied to a resolvable account (e.g. a
  // failed login against an email with no matching User) — see
  // metadata.attemptedEmail in that case instead of inventing a placeholder id.
  actor: Types.ObjectId | null;
  action: AuditAction;
  category: AuditActionCategory;
  targetType: "User";
  targetId: Types.ObjectId | null;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    category: { type: String, enum: ["auth", "permissions", "staff"], required: true },
    targetType: { type: String, enum: ["User"], required: true },
    targetId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String },
  },
  // createdAt only — no updatedAt on an append-only, never-updated log.
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Backs the admin timeline's default (newest-first) query and the
// action/actor filters narrowing it — mirrors Notification.ts's
// recipient/read/createdAt compound index reasoning, tuned to this model's
// own primary query shape instead.
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
