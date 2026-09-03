import mongoose, { Document, Schema, Types } from "mongoose";
import type { TicketPriority } from "./Ticket";

export type SlaTargetHistoryAction = "create" | "update" | "delete";

export interface ISlaTargetSnapshot {
  priority: TicketPriority | null;
  category: string | null;
  responseMinutes: number;
  resolutionMinutes: number;
}

/**
 * Append-only audit trail for SlaTarget mutations (sla-automation Story 25).
 * Kept as its own collection (rather than embedded on SlaTarget, like
 * statusHistory on Ticket) because a "delete" entry must survive after its
 * parent row is gone.
 */
export interface ISlaTargetHistoryEntry extends Document {
  target: Types.ObjectId; // may reference a now-deleted SlaTarget
  action: SlaTargetHistoryAction;
  before: ISlaTargetSnapshot | null; // null on "create"
  after: ISlaTargetSnapshot | null; // null on "delete"
  changedBy: Types.ObjectId; // ref: "User"
  changedAt: Date;
}

const snapshotSchema = new Schema<ISlaTargetSnapshot>(
  {
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: null },
    category: { type: String, default: null },
    responseMinutes: { type: Number, required: true },
    resolutionMinutes: { type: Number, required: true },
  },
  { _id: false }
);

const slaTargetHistorySchema = new Schema<ISlaTargetHistoryEntry>({
  target: { type: Schema.Types.ObjectId, required: true, index: true },
  action: { type: String, enum: ["create", "update", "delete"], required: true },
  before: { type: snapshotSchema, default: null },
  after: { type: snapshotSchema, default: null },
  changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  changedAt: { type: Date, required: true, default: () => new Date() },
});

// Backs GET /history's most-recent-first, capped read.
slaTargetHistorySchema.index({ changedAt: -1 });

export const SlaTargetHistory = mongoose.model<ISlaTargetHistoryEntry>(
  "SlaTargetHistory",
  slaTargetHistorySchema
);
