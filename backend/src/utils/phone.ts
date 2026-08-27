// Egyptian mobile numbers specifically, per direct instruction — this
// platform's customer base is Egypt-based (Arabic-first UI, Egyptian test
// data throughout this project). Previously a generic "7-15 digits,
// international-looking" rule, which incorrectly accepted malformed numbers
// like "1032017366" (missing the leading 0 a real local number needs).
//
// Accepts either:
//   local:         01<operator><8 digits>   — e.g. 01032017366 (11 digits)
//   international:  +201<operator><8 digits> — e.g. +201032017366
// where <operator> is one of 0, 1, 2, 5 (Egypt's mobile operator prefixes).
const EGYPT_LOCAL = /^01[0125]\d{8}$/;
const EGYPT_INTL = /^\+201[0125]\d{8}$/;

export function isValidPhone(raw: string): boolean {
  const compact = raw.replace(/[\s\-().]/g, "");
  return EGYPT_LOCAL.test(compact) || EGYPT_INTL.test(compact);
}
