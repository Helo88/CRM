// Shared by knowledge-base Stories 29 (FAQs), 30 (help articles) and 31
// (customer browsing) — one taxonomy across the whole knowledge base, so the
// customer-facing browse page can filter FAQs and articles with a single
// category control. Labels are NOT here: they are bilingual and live in
// frontend/messages/{en,ar}.json under "KbCategories", keyed by these exact
// slugs. Fixed, code-level list rather than an admin-managed collection — a
// third CRUD surface for a list expected to change once a year isn't worth
// it. NEVER remove a slug once documents may reference it; add new ones and
// stop offering the old one in the admin picker if it must be retired.
export const KB_CATEGORY_SLUGS = [
  "getting-started",
  "account-and-profile",
  "tickets-and-support",
  "live-chat",
  "billing-and-payments",
  "troubleshooting",
  "privacy-and-security",
] as const;
export type KbCategorySlug = (typeof KB_CATEGORY_SLUGS)[number];

export const FAQ_QUESTION_MAX_LENGTH = 300;
export const FAQ_ANSWER_MAX_LENGTH = 5000;

export const ARTICLE_TITLE_MAX_LENGTH = 200;
export const ARTICLE_SUMMARY_MAX_LENGTH = 400;
// Generous, but bounded — an unbounded body is an unbounded request payload
// and an unbounded render on a public page.
export const ARTICLE_BODY_MAX_LENGTH = 50_000;
export const ARTICLE_SLUG_MAX_LENGTH = 120;
export const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
