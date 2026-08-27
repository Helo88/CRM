// Mirrors backend/src/utils/phone.ts — Egyptian mobile numbers specifically.
// Frontend copy exists for fast client-visible feedback; the backend
// validation is what's actually authoritative.
const EGYPT_LOCAL = /^01[0125]\d{8}$/;
const EGYPT_INTL = /^\+201[0125]\d{8}$/;

export function isValidPhone(raw: string): boolean {
  const compact = raw.replace(/[\s\-().]/g, "");
  return EGYPT_LOCAL.test(compact) || EGYPT_INTL.test(compact);
}
