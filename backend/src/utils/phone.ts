// No story or existing code specifies a phone format — this platform has no
// single-country assumption (see CLAUDE.md's "don't hardcode a single
// implicit branch/locale" guidance), so validation stays intentionally
// permissive: any international-looking number, not one country's format.
const PHONE_SHAPE = /^\+?[0-9\s\-().]+$/;
const PHONE_DIGITS_MIN = 7;
const PHONE_DIGITS_MAX = 15; // E.164 max

export function isValidPhone(raw: string): boolean {
  if (!PHONE_SHAPE.test(raw)) return false;
  const digitCount = raw.replace(/\D/g, "").length;
  return digitCount >= PHONE_DIGITS_MIN && digitCount <= PHONE_DIGITS_MAX;
}
