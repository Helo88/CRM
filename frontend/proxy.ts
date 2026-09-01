import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";

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
  const hasAccess = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const hasRefresh = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  // The access cookie's short ~15min maxAge means it routinely expires while
  // the refresh cookie is still valid (see lib/session.ts). Left alone, every
  // Server Component that only *peeks* at the access token for a UI decision
  // (SiteHeader's staff-vs-customer nav, role/name in UserMenu — see
  // lib/jwt.ts's peekJwtPayload) silently renders the signed-out/customer
  // shape for that one request, since it never makes a backend call and so
  // never triggers the existing per-page "redirect to /api/session/refresh
  // on 401" pattern (see settings/page.tsx). Proactively route through the
  // refresh flow here instead, before any page renders, so that gap closes
  // for every page at once rather than only pages that happen to fetch
  // something from the backend.
  if (!hasAccess && hasRefresh) {
    const refreshUrl = new URL("/api/session/refresh", request.url);
    refreshUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(refreshUrl);
  }

  const isProtected = PROTECTED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));
  if (isProtected && !hasAccess && !hasRefresh) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      // Everything except: API/Route Handlers (avoids a redirect loop with
      // /api/session/refresh itself, and leaves the attachment-download
      // routes' own auth handling alone), static/image assets, and the
      // public login/register pages (no session to refresh there).
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|login|register).*)",
      missing: [
        // Server Actions land as a POST to the current page's own route —
        // excluding this path would also skip the action call (Next.js
        // docs: proxy.md, "Execution order"). They already refresh inline
        // and retry (see settings/actions.ts) rather than redirecting, which
        // would otherwise silently drop whatever was being submitted.
        { type: "header", key: "next-action" },
        // <Link> hover/viewport prefetches shouldn't spend a network round
        // trip rotating the refresh token — only a real navigation should.
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
