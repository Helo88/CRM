import { NextRequest, NextResponse } from "next/server";
import { refreshSession } from "@/lib/session";

// GET only — Server Components can't write cookies themselves, so on a 401
// they redirect() here (a real browser navigation) instead of refreshing
// inline. See .squad/plans/auth/02-story-login-customer-agent-or-admin.md,
// "Addendum: Refresh token mechanism".
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") || "/";

  const token = await refreshSession();
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // One-shot marker: if the target page still gets a 401 after this refresh,
  // it must not redirect back here again (that would loop) — it should treat
  // the session as genuinely dead instead.
  const target = new URL(next, request.url);
  target.searchParams.set("_refreshed", "1");
  return NextResponse.redirect(target);
}
