import mongoose, { Document, Schema, Types } from "mongoose";

export type UserRole = "customer" | "agent" | "admin";
export type Language = "en" | "ar";

export interface IAttachment {
  fileName: string;
  url: string;
  uploadedBy?: Types.ObjectId;
  createdAt?: Date;
}

export interface IInternalNote {
  text: string;
  authorId?: Types.ObjectId;
  createdAt?: Date;
}

/**
 * Covers Customer, Agent, and Admin — they share login/role mechanics (auth feature).
 * Customer-specific fields (notes, attachments) support the customer-management feature
 * (Stories 4-7). If this grows unwieldy, split customer-only fields into a separate
 * CustomerProfile collection referencing this one — not needed yet at this scale.
 */
export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone?: string;
  preferredLanguage: Language;
  // Story 5 (customer-management): set while a customer has an unconfirmed
  // email change in flight. `email` itself only changes once the customer
  // clicks the confirmation link — see backend/src/routes/me.routes.ts.
  pendingEmail?: string | null;
  emailConfirmToken?: string | null;
  emailConfirmTokenExpiresAt?: Date | null;
  isOnline: boolean;
  internalNotes: IInternalNote[];
  attachments: IAttachment[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    fileName: String,
    url: String,
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const internalNoteSchema = new Schema<IInternalNote>(
  {
    text: String,
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["customer", "agent", "admin"], required: true },
    phone: String,
    preferredLanguage: { type: String, enum: ["en", "ar"], default: "en" },

    // Story 5 (customer-management): confirm-then-apply email change.
    pendingEmail: { type: String, default: null, lowercase: true, trim: true },
    emailConfirmToken: { type: String, default: null, index: true },
    emailConfirmTokenExpiresAt: { type: Date, default: null },

    // Agent-specific (agent-workspace feature, Story 21)
    isOnline: { type: Boolean, default: false },

    // Customer-specific (customer-management feature, Story 7)
    internalNotes: [internalNoteSchema],
    attachments: [attachmentSchema],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
