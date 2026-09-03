import mongoose, { Document, Schema } from "mongoose";
import type { TicketPriority } from "./Ticket";

/**
 * sla-automation Story 25 (define SLA targets).
 *
 * Admin-editable lookup rows that Story 26 (track SLA timers) will consult
 * at Ticket / Conversation creation time to stamp
 * `Ticket.sla.responseTargetAt` / `resolutionTargetAt`. Rows are keyed by
 * (priority, category); either or both may be null to widen the row's
 * scope. The (null, null) row is the mandatory system default —
 * enforced by seed migration (backend/scripts/seed-default-sla-target.ts),
 * NOT by unique index (a unique index can't express "this exact pair must
 * always exist," only "no two rows may share it").
 *
 * Match precedence (documented for Story 26, NOT implemented here):
 *   1. exact (priority, category)
 *   2. (priority, null)
 *   3. (null, category)
 *   4. (null, null)  <- default fallback
 *
 * Durations are stored as MINUTES (integer) so downstream date arithmetic
 * is simple and there's no float drift; UI displays as hh:mm.
 */
export interface ISlaTarget extends Document {
  priority: TicketPriority | null;
  category: string | null; // name-copied snapshot, matches Ticket.category
  responseMinutes: number; // > 0
  resolutionMinutes: number; // > 0, must be >= responseMinutes
  createdAt: Date;
  updatedAt: Date;
}

const slaTargetSchema = new Schema<ISlaTarget>(
  {
    // KEEP IN SYNC WITH backend/src/models/Ticket.ts's TicketPriority enum.
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: null },
    category: { type: String, default: null },
    responseMinutes: { type: Number, required: true, min: 1 },
    resolutionMinutes: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

// Uniqueness on the (priority, category) pair — including the wildcard
// (null, null) default row. Mongo treats a missing/null field as equal
// across documents in a unique index, so a second (null, null) insert is
// correctly rejected the same way a second (urgent, Billing) would be.
slaTargetSchema.index({ priority: 1, category: 1 }, { unique: true });

export const SlaTarget = mongoose.model<ISlaTarget>("SlaTarget", slaTargetSchema);
