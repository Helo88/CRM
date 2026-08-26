import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * One document per login session (a "refresh token family"), not one per
 * rotation — see .squad/plans/auth/02-story-login-customer-agent-or-admin.md,
 * "Addendum: Refresh token mechanism" for the full design. `currentHeadHash`
 * is the SHA-256 hash of the only currently-valid refresh token in this
 * family; rotation is a deterministic HMAC chain (backend/src/utils/refreshToken.ts),
 * so concurrent requests converge on the same successor instead of forking
 * the family. `sessionExpiresAt` is written once at login and never updated
 * by rotation — that's what makes it a real absolute cap on session lifetime.
 */
export interface IRefreshFamily extends Document {
  familyId: string;
  userId: Types.ObjectId;
  currentHeadHash: string;
  sessionExpiresAt: Date;
  revoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const refreshFamilySchema = new Schema<IRefreshFamily>(
  {
    familyId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    currentHeadHash: { type: String, required: true },
    sessionExpiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const RefreshFamily = mongoose.model<IRefreshFamily>("RefreshFamily", refreshFamilySchema);
