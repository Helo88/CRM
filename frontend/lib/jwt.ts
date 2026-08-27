// Unverified peek at the access token's claims, for UI decisions only (e.g.
// whether to show a staff-only nav link, or a display name/avatar-initial).
// This is NOT a security boundary — the backend's requireRole is what
// actually authorizes access; this only avoids showing dead-end UI.
export function peekJwtPayload(token: string): { role?: string; name?: string } {
  try {
    const payloadSegment = token.split(".")[1];
    const json = Buffer.from(payloadSegment, "base64url").toString("utf8");
    const payload = JSON.parse(json);
    return {
      role: typeof payload.role === "string" ? payload.role : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  } catch {
    return {};
  }
}
