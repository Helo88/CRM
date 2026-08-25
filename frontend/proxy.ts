import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

// Thin Proxy (Next.js 16 convention, formerly "middleware"): presence-only
// check that redirects an unauthenticated request away from a protected page
// before it renders. This is NOT the real security boundary — the JWT's
// signature is verified for real by the backend (requireAuth) on every API
// call a Server Component/Server Action makes. Intentionally does not verify
// the token itself here (defense in depth: don't rely on a single layer, and
// proxy.ts is meant to stay a thin redirect/rewrite layer, not do heavy
// validation).
const PROTECTED_PATHS = ["/settings"];

export function proxy(request: NextRequest) {
  const isProtected = PROTECTED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/settings/:path*"],
};
