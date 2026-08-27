import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { NewStaffAccountForm } from "./NewStaffAccountForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NewStaffAccount");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

// USER_STORIES.md security-admin Story 45. Only a full admin ever reaches
// this UI — narrower than the customer-creation page's agent-or-admin gate,
// since account creation (agent/sub-admin) is admin-only. Role is checked
// directly from the access token, same UI-nicety caveat as
// customers/new/page.tsx: requireRole on the actual POST is what really
// enforces this.
export default async function NewStaffAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ _refreshed?: string }>;
}) {
  const { _refreshed } = await searchParams;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!accessToken) {
    if (hasRefreshToken && !_refreshed) {
      redirect("/api/session/refresh?next=/admin/users/new");
    }
    redirect("/");
  }

  const { role } = peekJwtPayload(accessToken);
  if (role !== "admin") {
    redirect("/admin/users");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <NewStaffAccountForm />
    </main>
  );
}
