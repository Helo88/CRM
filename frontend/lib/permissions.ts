// Mirrors backend/src/constants/permissions.ts's PERMISSION_KEYS. Kept as a
// plain hardcoded list here (same convention as role labels already
// duplicated across the frontend's i18n messages) rather than fetched from
// an API — the vocabulary is fixed and rarely changes.
export const PERMISSION_CATEGORIES: Record<string, string[]> = {
  users: ["users:manage", "users:permissions"],
  audit: ["audit:view"],
  config: ["config:edit"],
  customers: ["customers:manage"],
  tickets: ["tickets:delete", "tickets:reassign", "tickets:view_all"],
  sla: ["sla:configure"],
  kb: ["kb:publish"],
  reports: ["reports:view", "reports:export"],
  ai: ["ai:override_category"],
};
