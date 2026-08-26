// Shared conventions for the frontend's auth BFF (Backend-for-Frontend) layer.
// The session token lives ONLY in this httpOnly cookie, set by Server
// Actions (login/register/actions.ts) and lib/session.ts. It is never
// exposed to client-side JavaScript — authenticated pages are Server
// Components (cookies() + a server-side call to the Express API);
// client-side mutations go through Server Actions, which read this same
// cookie server-side.
export const SESSION_COOKIE = "session_token";

// Refresh token, same httpOnly/never-client-readable treatment. See
// .squad/plans/auth/02-story-login-customer-agent-or-admin.md ("Addendum:
// Refresh token mechanism") and lib/session.ts for the rotation flow.
export const REFRESH_COOKIE = "refresh_token";

// Must match the backend's JWT_EXPIRES_IN / REFRESH_TOKEN_TTL (backend/.env)
// so a cookie never outlives — or meaningfully outlasts — the token inside it.
export const ACCESS_TOKEN_MAX_AGE_S = 15 * 60;
export const REFRESH_TOKEN_MAX_AGE_S = 30 * 24 * 60 * 60;

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
