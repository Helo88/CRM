import type { Locale } from "@/lib/locale";

export interface LocalizedText {
  en: string;
  ar: string;
}

// Picks the viewer's language for CONTENT (an FAQ's question, an article's
// body) — a completely separate concern from next-intl's `t()`, which
// translates the UI CHROME. Chrome is translated by us at build time from
// messages/{en,ar}.json; content is typed by an admin at authoring time and
// stored in the document. Both are driven by the same LOCALE_COOKIE, and
// that is the only thing they share.
//
// There's no draft/published gate guaranteeing both languages are filled
// (product decision, 2026-09-02 — an FAQ/article is live as soon as it's
// saved), so this fallback is load-bearing, not just defence in depth: a
// half-translated entry still renders, in whichever language IS present.
export function pickLocalized(
  text: LocalizedText,
  locale: Locale
): { value: string; language: Locale } {
  const primary = text[locale]?.trim();
  if (primary) return { value: primary, language: locale };
  const other: Locale = locale === "en" ? "ar" : "en";
  return { value: text[other]?.trim() ?? "", language: other };
}
