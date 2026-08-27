import mongoose, { Document, Schema, Types } from "mongoose";
import { PERMISSION_KEYS, PermissionKey } from "../constants/permissions";

export type UserRole = "customer" | "agent" | "admin" | "subadmin";
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
  // security-admin Story 46: permissions are granted PER INDIVIDUAL account,
  // not per role — only meaningful for role "agent"/"subadmin" ("admin"
  // always has every permission regardless of this field; "customer" never
  // has any). See backend/src/constants/permissions.ts and
  // backend/src/services/permissions.ts's hasPermission().
  permissions: PermissionKey[];
  // security-admin Story 45: soft-delete for staff accounts (agent/admin/
  // subadmin) — a deleted account is hidden from the roster and fully
  // locked out (isActive is also forced false), but the document is kept
  // for referential integrity (past ticket assignments, audit log entries).
  isDeleted: boolean;
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
    role: { type: String, enum: ["customer", "agent", "admin", "subadmin"], required: true },
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

    // security-admin Story 46: per-individual-account permissions (agent/subadmin only).
    permissions: [{ type: String, enum: PERMISSION_KEYS }],

    // security-admin Story 45: soft-delete for staff accounts.
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
