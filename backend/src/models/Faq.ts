import mongoose, { Document, Schema, Types } from "mongoose";
import { ILocalizedText, localizedTextSchema } from "./localizedText";
import { KB_CATEGORY_SLUGS, KbCategorySlug, FAQ_QUESTION_MAX_LENGTH, FAQ_ANSWER_MAX_LENGTH } from "../constants/kb";

/**
 * knowledge-base Story 29. The first bilingual CONTENT model in this
 * codebase — `question` and `answer` each hold both languages in one
 * document (see models/localizedText.ts for why).
 *
 * No draft/published state: an FAQ is visible to customers as soon as it's
 * created (product decision, 2026-09-02 — simpler than the originally
 * planned draft-then-publish workflow; a category badge is the only status
 * a viewer ever sees). A half-translated FAQ is served with a fallback
 * language by `pickLocalized` rather than being hidden.
 *
 * Soft delete, not a hard delete: mirrors User.isDeleted. Deleting a
 * translated pair of strings is unrecoverable, and a future audit log will
 * want the document to still exist to point at. Nothing in the app ever
 * reads a deleted FAQ.
 */
export interface IFaq extends Document {
  question: ILocalizedText;
  answer: ILocalizedText;
  category: KbCategorySlug;
  isDeleted: boolean;
  // Current-state authorship only — NOT an audit trail. Nullable so a
  // future seed/import path doesn't need a synthetic user.
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const faqSchema = new Schema<IFaq>(
  {
    question: { type: localizedTextSchema(FAQ_QUESTION_MAX_LENGTH), required: true },
    answer: { type: localizedTextSchema(FAQ_ANSWER_MAX_LENGTH), required: true },
    category: { type: String, enum: KB_CATEGORY_SLUGS, required: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// The public browse query (Story 31) and the admin list: not-deleted,
// optionally narrowed to one category, ordered for reading.
faqSchema.index({ isDeleted: 1, category: 1, createdAt: -1 });
faqSchema.index({ isDeleted: 1, category: 1, updatedAt: -1 });

export const Faq = mongoose.model<IFaq>("Faq", faqSchema);
