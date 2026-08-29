// Unverified peek at the access token's claims, for UI decisions only (e.g.
// whether to show a staff-only nav link, or a display name/avatar-initial).
// This is NOT a security boundary — the backend's requireRole is what
// actually authorizes access; this only avoids showing dead-end UI.
export function peekJwtPayload(token: string): {
  id?: string;
  role?: string;
  name?: string;
  email?: string;
  permissions?: string[];
  membershipNumber?: string;
} {
  try {
    const payloadSegment = token.split(".")[1];
    const json = Buffer.from(payloadSegment, "base64url").toString("utf8");
    const payload = JSON.parse(json);
    return {
      id: typeof payload.sub === "string" ? payload.sub : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
      permissions:
        Array.isArray(payload.permissions) && payload.permissions.every((p: unknown) => typeof p === "string")
          ? payload.permissions
          : undefined,
      membershipNumber: typeof payload.membershipNumber === "string" ? payload.membershipNumber : undefined,
    };
  } catch {
    return {};
  }
}
