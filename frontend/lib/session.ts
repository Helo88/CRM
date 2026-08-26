import { cookies } from "next/headers";
import {
  API_URL,
  SESSION_COOKIE,
  REFRESH_COOKIE,
  ACCESS_TOKEN_MAX_AGE_S,
  REFRESH_TOKEN_MAX_AGE_S,
} from "@/lib/auth";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// Only callable from a Server Action or Route Handler — cookies().set()
// throws everywhere else (Server Components can only read cookies). See
// .squad/plans/auth/02-story-login-customer-agent-or-admin.md, "Addendum:
// Refresh token mechanism", for why the frontend design routes around this.
export async function setSessionCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, accessToken, { ...COOKIE_OPTS, maxAge: ACCESS_TOKEN_MAX_AGE_S });
  cookieStore.set(REFRESH_COOKIE, refreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_TOKEN_MAX_AGE_S });
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

/**
 * Rotates the refresh token and mints a fresh access token, persisting both
 * as httpOnly cookies. Called directly (in-process, not over HTTP) by both
 * the Server-Component redirect flow (via app/api/session/refresh/route.ts)
 * and the inline Server-Action retry flow (e.g. settings/actions.ts) — see
 * the plan addendum for why those are the only two legal callers.
 * Returns the new access token, or null if the refresh token is missing,
 * invalid, expired, or was flagged as reused (caller must treat the
 * session as dead — clearSessionCookies() has already run in that case).
 */
export async function refreshSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    await clearSessionCookies();
    return null;
  }

  const data = await res.json();
  await setSessionCookies(data.token, data.refreshToken);
  return data.token as string;
}
