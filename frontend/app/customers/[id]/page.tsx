import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { CustomerProfileForm } from "./CustomerProfileForm";

// Same 401/refresh handling as settings/page.tsx — see that file's comment
// and .squad/plans/auth/02-story-login-customer-agent-or-admin.md for why.
export default async function CustomerProfilePage({
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
      redirect(`/api/session/refresh?next=/customers/${id}`);
    }
    redirect("/");
  }

  const t = await getTranslations("CustomerProfile");
  const res = await fetch(`${API_URL}/api/v1/customers/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401 && !_refreshed) {
    redirect(`/api/session/refresh?next=/customers/${id}`);
  }

  if (!res.ok) {
    return (
      <main className="flex min-h-[calc(100vh-57px)] items-center justify-center p-8">
        <p className="text-muted-foreground">{t("notFound")}</p>
      </main>
    );
  }

  const profile = await res.json();

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center p-8">
      <CustomerProfileForm profile={profile} />
    </main>
  );
}
