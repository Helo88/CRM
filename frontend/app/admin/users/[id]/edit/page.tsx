import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { EditStaffAccountForm } from "./EditStaffAccountForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("EditStaffAccount");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

interface StaffAccountDetail {
  id: string;
  name: string;
  email: string;
  role: "agent" | "admin" | "subadmin";
  permissions: string[];
}

// USER_STORIES.md security-admin Story 45/46 addendum: editing an existing
// agent/sub-admin's data AND permissions together, mirroring the creation
// stepper's two steps. Reachable by admin or a sub-admin holding
// users:manage on their own account — the fetch below's 403 handles the
// "reached the URL but isn't actually delegated" case, same pattern as the
// roster page.
export default async function EditStaffAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ _refreshed?: string }>;
}) {
  const { id } = await params;
  const { _refreshed } = await searchParams;
  const t = await getTranslations("EditStaffAccount");

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!token) {
    if (hasRefreshToken && !_refreshed) {
      redirect(`/api/session/refresh?next=/admin/users/${id}/edit`);
    }
    redirect("/");
  }

  const res = await fetch(`${API_URL}/api/v1/admin/users/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    if (!_refreshed) {
      redirect(`/api/session/refresh?next=/admin/users/${id}/edit`);
    }
    redirect("/login");
  }

  if (res.status === 403) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-muted-foreground">{t("noAccess")}</p>
      </main>
    );
  }

  if (!res.ok) {
    redirect("/admin/users");
  }

  const account: StaffAccountDetail = await res.json();
  if (account.role === "admin") {
    // Admin accounts aren't editable through this UI at all — see
    // backend/src/routes/admin.routes.ts's PATCH /:id.
    redirect("/admin/users");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <EditStaffAccountForm account={{ ...account, role: account.role as "agent" | "subadmin" }} />
    </main>
  );
}
