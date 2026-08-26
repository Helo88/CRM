import crypto from "crypto";

const FAMILY_ID_BYTES = 16;
const ROOT_SECRET_BYTES = 32;

/**
 * Refresh token = "<familyId>.<secret>". familyId is a lookup key only (not
 * a security boundary, like a session id); secret is what gets hashed and
 * compared. Rotation is a deterministic HMAC chain — see
 * .squad/plans/auth/02-story-login-customer-agent-or-admin.md, "Addendum:
 * Refresh token mechanism" — so concurrent refreshes of the same token
 * always derive the identical successor instead of branching.
 */
export function generateFamilyId(): string {
  return crypto.randomBytes(FAMILY_ID_BYTES).toString("base64url");
}

export function generateRootToken(familyId: string): string {
  const secret = crypto.randomBytes(ROOT_SECRET_BYTES).toString("base64url");
  return `${familyId}.${secret}`;
}

export function parseFamilyId(token: string): string | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0 || dotIndex === token.length - 1) return null;
  return token.slice(0, dotIndex);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function deriveSuccessor(token: string): string {
  const secret = process.env.REFRESH_CHAIN_SECRET as string;
  const familyId = parseFamilyId(token);
  const digest = crypto.createHmac("sha256", secret).update(token).digest("base64url");
  return `${familyId}.${digest}`;
}

const DURATION_UNITS_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parses a simple "<number><s|m|h|d>" duration string (e.g. "30d") to milliseconds. */
export function parseDurationMs(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration "${duration}" — expected a format like "30d" or "15m"`);
  }
  const [, amount, unit] = match;
  return Number(amount) * DURATION_UNITS_MS[unit];
}

/** Constant-time equality for two hex hash strings of equal expected length. */
export function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
