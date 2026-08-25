// Shared conventions for the frontend's auth BFF (Backend-for-Frontend) layer.
// The session token lives ONLY in this httpOnly cookie, set by the Route
// Handlers under app/api/auth/*. It is never exposed to client-side
// JavaScript — authenticated pages are Server Components (cookies() + a
// server-side call to the Express API); client-side mutations go through
// Server Actions, which read this same cookie server-side.
export const SESSION_COOKIE = "session_token";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
