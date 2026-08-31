import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { StaffSidebar } from "@/components/StaffSidebar";
import { SettingsForm } from "./SettingsForm";

// Authenticated page — not meant to be indexed, but still wants a real
// <title> for the browser tab/history (see CLAUDE.md, "SEO (frontend pages)").
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

// Server Component: reads the httpOnly session cookie server-side and calls
// the backend directly — the JWT never reaches client-side JavaScript.
// proxy.ts already redirects unauthenticated requests before this renders;
// the check here is defense in depth, not the only gate.
//
// This is the reference pattern for a future authenticated page's 401
// handling (see CLAUDE.md's Frontend auth section) — see
// .squad/plans/auth/02-story-login-customer-agent-or-admin.md, "Addendum:
// Refresh token mechanism", for the full reasoning:
//
// A Server Component cannot refresh its own session — cookies().set() throws
// outside a Server Action/Route Handler — so on a 401 (or an outright
// missing access cookie, which happens routinely once it has a short ~15min
// maxAge) it redirects to /api/session/refresh, the one place that CAN
// rotate the tokens and rewrite the cookies, then comes back. The
// `_refreshed` marker is a one-shot loop guard: if the page still 401s right
// after a refresh, the session is genuinely dead, not just momentarily
// stale — go to /login instead of refreshing again.
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ _refreshed?: string }>;
}) {
  const { _refreshed } = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!token) {
    if (hasRefreshToken && !_refreshed) {
      redirect("/api/session/refresh?next=/settings");
    }
    redirect("/");
  }

  const res = await fetch(`${API_URL}/api/v1/me/contact`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) {
    if (!_refreshed) {
      redirect("/api/session/refresh?next=/settings");
    }
    redirect("/login");
  }
  if (!res.ok) {
    redirect("/");
  }
  const contact = await res.json();
  // This page (unlike most authenticated pages) is reachable by both
  // personas — a customer and staff alike edit their own contact info here —
  // so StaffSidebar only renders for the staff case, same "gate on role, not
  // the page" pattern as tickets/[id]/page.tsx. There's no matching rail
  // item for /settings (it's reached via UserMenu, not the rail), so no
  // `active` is passed.
  const { role } = peekJwtPayload(token);
  const isStaff = role === "agent" || role === "admin" || role === "subadmin";

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      {isStaff && <StaffSidebar />}
      <main className="flex min-w-0 flex-1 items-center justify-center p-8">
        <SettingsForm contact={contact} />
      </main>
    </div>
  );
}
