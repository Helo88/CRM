// Mirrors backend/src/utils/phone.ts — kept deliberately permissive since no
// story specifies a phone format and this platform has no single-country
// assumption. Frontend copy exists for fast client-visible feedback; the
// backend validation is what's actually authoritative.
const PHONE_SHAPE = /^\+?[0-9\s\-().]+$/;
const PHONE_DIGITS_MIN = 7;
const PHONE_DIGITS_MAX = 15;

export function isValidPhone(raw: string): boolean {
  if (!PHONE_SHAPE.test(raw)) return false;
  const digitCount = raw.replace(/\D/g, "").length;
  return digitCount >= PHONE_DIGITS_MIN && digitCount <= PHONE_DIGITS_MAX;
}
