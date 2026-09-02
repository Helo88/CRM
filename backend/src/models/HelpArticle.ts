import mongoose, { Document, Schema, Types } from "mongoose";
import { ILocalizedText, localizedTextSchema } from "./localizedText";
import {
  KB_CATEGORY_SLUGS,
  KbCategorySlug,
  ARTICLE_TITLE_MAX_LENGTH,
  ARTICLE_SUMMARY_MAX_LENGTH,
  ARTICLE_BODY_MAX_LENGTH,
  ARTICLE_SLUG_MAX_LENGTH,
  ARTICLE_SLUG_PATTERN,
} from "../constants/kb";

/**
 * knowledge-base Story 30. Same bilingual/soft-delete/no-draft reasoning as
 * models/Faq.ts (read it first) — a help article is live as soon as it's
 * saved, and `createdBy`/`updatedBy` are current-state fields, not an audit
 * trail.
 *
 * `body` is MARKDOWN, per language. Rendered client-side with
 * react-markdown WITHOUT rehype-raw (frontend/components/ArticleBody.tsx) —
 * raw HTML in the source renders as inert text, so there is no
 * HTML-injection surface to sanitise against.
 */
export interface IHelpArticle extends Document {
  /** Language-neutral, URL-stable, unique case-insensitively (incl. soft-deleted rows). */
  slug: string;
  title: ILocalizedText;
  /** Short excerpt: list cards, and the public detail page's SEO meta description. */
  summary: ILocalizedText;
  body: ILocalizedText;
  category: KbCategorySlug;
  isDeleted: boolean;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  /** The "last-updated date" shown to customers — from timestamps: true, no custom field. */
  updatedAt: Date;
}

const helpArticleSchema = new Schema<IHelpArticle>(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: ARTICLE_SLUG_MAX_LENGTH,
      match: ARTICLE_SLUG_PATTERN,
    },
    title: { type: localizedTextSchema(ARTICLE_TITLE_MAX_LENGTH), required: true },
    summary: { type: localizedTextSchema(ARTICLE_SUMMARY_MAX_LENGTH), required: true },
    body: { type: localizedTextSchema(ARTICLE_BODY_MAX_LENGTH), required: true },
    category: { type: String, enum: KB_CATEGORY_SLUGS, required: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// Case-insensitive uniqueness across the whole collection, INCLUDING
// soft-deleted rows, so a deleted slug can't be silently reused with old
// links resurrecting pointing at different content. Handlers must query
// with the same collation (see helpArticle.service.ts).
helpArticleSchema.index({ slug: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
helpArticleSchema.index({ isDeleted: 1, category: 1, updatedAt: -1 });

export const HelpArticle = mongoose.model<IHelpArticle>("HelpArticle", helpArticleSchema);
