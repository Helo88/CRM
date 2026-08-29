import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { StaffSidebar } from "@/components/StaffSidebar";
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
  isActive: boolean;
  permissions: string[];
}

// USER_STORIES.md security-admin Story 45/46 addendum: editing an existing
// agent/sub-admin's data AND permissions together, mirroring the creation
// stepper's two steps. Reachable by admin or a sub-admin holding
// staff:view_account on their own account — the fetch below's 403 redirects
// to /dashboard for the "reached the URL but isn't actually delegated" case,
// same pattern as the roster page. Once in, staff:edit/staff:permissions
// (checked below) decide whether the form is editable or view-only.
export default async function EditStaffAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ _refreshed?: string }>;
}) {
  const { id } = await params;
  const { _refreshed } = await searchParams;

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
    // No staff:view_account at all — same reasoning as the roster's 403:
    // land somewhere useful instead of a dead-end message.
    redirect("/dashboard");
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

  const { role: viewerRole, permissions: viewerPermissions = [] } = peekJwtPayload(token);
  const isViewerAdmin = viewerRole === "admin";
  const canEditDetails = isViewerAdmin || viewerPermissions.includes("staff:edit");
  const canEditPermissions = isViewerAdmin || viewerPermissions.includes("staff:permissions");

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar active="accounts" />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <EditStaffAccountForm
          account={{ ...account, role: account.role as "agent" | "subadmin" }}
          canEditDetails={canEditDetails}
          canEditPermissions={canEditPermissions}
        />
      </main>
    </div>
  );
}
