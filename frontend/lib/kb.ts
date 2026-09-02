// Mirrors backend/src/constants/kb.ts's KB_CATEGORY_SLUGS. Kept in lockstep
// in the same change, same convention as lib/permissions.ts.
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
