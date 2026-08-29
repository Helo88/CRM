import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookies } from "@/lib/session";

// GET only, same reasoning as ../refresh/route.ts — Server Components can't
// write cookies themselves, so dashboard/page.tsx redirect()s here on
// detecting (via the live GET /api/v1/me/status check) that the signed-in
// account was deactivated mid-session. No server-side revocation call here
// (unlike app/actions.ts's logout()) — deactivation itself already made the
// refresh token unusable (auth.routes.ts's /refresh rejects a deactivated
// account outright), so there's nothing left to revoke, only local cookies
// to clear.
export async function GET(request: NextRequest) {
  await clearSessionCookies();
  return NextResponse.redirect(new URL("/", request.url));
}
