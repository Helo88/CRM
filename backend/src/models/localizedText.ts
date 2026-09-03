import { Schema } from "mongoose";
import type { Language } from "./User";

/**
 * The project's ONE bilingual-content shape. Introduced by knowledge-base
 * Story 29 (FAQs) and reused unchanged by Story 30 (help articles) — every
 * customer-facing text field on a bilingual content model is one of these,
 * never two parallel scalar fields (`questionEn`/`questionAr`) and never a
 * separate document per language.
 *
 * Keys are exactly the `Language` union from models/User.ts — do not
 * redefine "en" | "ar" anywhere else.
 */
export type ILocalizedText = Record<Language, string>;

export function localizedTextSchema(maxlength: number) {
  return new Schema<ILocalizedText>(
    {
      // Neither side is `required` at the schema level — a caller may
      // legitimately submit only one language (the other fills in later, or
      // never); there is no draft/published gate requiring both (product
      // decision, 2026-09-02). `pickLocalized` (frontend/lib/localized.ts)
      // falls back to whichever language IS present when rendering.
      en: { type: String, default: "", trim: true, maxlength },
      ar: { type: String, default: "", trim: true, maxlength },
    },
    { _id: false }
  );
}
