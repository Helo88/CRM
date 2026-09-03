import mongoose, { Schema } from "mongoose";

/**
 * sla-automation Story 25, extended for Story 27's monitor tuning.
 * Singleton document — always exactly one row, fixed _id "default" — a
 * config table, not a per-priority/category lookup like SlaTarget.
 */
export interface ISlaSystemSettings {
  _id: string; // always "default"
  atRiskPercent: number; // 1-99, default 75
  scanIntervalMinutes: number; // 1-60, default 1
  updatedBy: mongoose.Types.ObjectId | null;
  updatedAt: Date;
}

const slaSystemSettingsSchema = new Schema<ISlaSystemSettings>(
  {
    _id: { type: String, default: "default" },
    atRiskPercent: { type: Number, required: true, min: 1, max: 99, default: 75 },
    scanIntervalMinutes: { type: Number, required: true, min: 1, max: 60, default: 1 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true }, _id: false }
);

export const SlaSystemSettings = mongoose.model<ISlaSystemSettings>(
  "SlaSystemSettings",
  slaSystemSettingsSchema
);

// sla-automation Story 27's monitor calls this on every scan cycle instead
// of reading a module-level constant, so an admin's change (made from
// /admin/system-configuration/sla-targets's settings card) takes effect on
// the very next cycle with no restart. No saved row yet (before any admin
// has touched the settings page) falls back to sensible defaults.
export async function getSlaSystemSettings(): Promise<{ atRiskPercent: number; scanIntervalMinutes: number }> {
  const doc = await SlaSystemSettings.findById("default").lean();
  return { atRiskPercent: doc?.atRiskPercent ?? 75, scanIntervalMinutes: doc?.scanIntervalMinutes ?? 1 };
}
