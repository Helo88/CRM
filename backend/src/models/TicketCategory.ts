import mongoose, { Document, Schema } from "mongoose";

/**
 * Source-of-truth list backing the ticket-management category picker
 * (Stories 9 and 57). Admins can add, rename, or deactivate entries; entries
 * are never hard-deleted so a Ticket document's `category` string (a
 * name-copied snapshot, not an ObjectId reference — see
 * backend/src/models/Ticket.ts) keeps rendering even after its source is
 * deactivated.
 *
 * Known gap: priority levels are NOT admin-editable in this story —
 * Ticket.priority stays a fixed 4-value enum. Making it configurable would
 * mean converting that enum into a reference collection like this one and
 * rewriting every priority-consuming call site (including SLA logic), which
 * was judged out of scope for this pass — see
 * .squad/stories/ticket-management/manage-ticket-categories-and-priorities/intake.md.
 */
export interface ITicketCategory extends Document {
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const TICKET_CATEGORY_NAME_MAX_LENGTH = 100; // matches CATEGORY_MAX_LENGTH in ticket.routes.ts

const ticketCategorySchema = new Schema<ITicketCategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: TICKET_CATEGORY_NAME_MAX_LENGTH },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Case-insensitive uniqueness on name across the whole collection —
// including inactive rows, so re-adding "Billing" after deactivation is
// rejected with a "reactivate it instead" error rather than silently
// creating a duplicate (enforced in ticketCategory.routes.ts's handlers,
// which query with the same collation).
ticketCategorySchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export const TicketCategory = mongoose.model<ITicketCategory>("TicketCategory", ticketCategorySchema);
