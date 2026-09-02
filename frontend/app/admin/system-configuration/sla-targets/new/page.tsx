import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { NewSlaTargetForm } from "./NewSlaTargetForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminSlaTargets");
  return { title: t("newButton"), robots: { index: false, follow: false } };
}

export default async function NewSlaTargetPage({
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
      redirect("/api/session/refresh?next=/admin/system-configuration/sla-targets/new");
    }
    redirect("/");
  }

  const { role, permissions = [] } = peekJwtPayload(accessToken);
  if (role !== "admin" && !permissions.includes("sla:targets_edit")) {
    redirect("/dashboard");
  }

  const categoriesRes = await fetch(`${API_URL}/api/v1/ticket-categories?active=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const categories: { id: string; name: string }[] = categoriesRes.ok ? await categoriesRes.json() : [];

  return (
    <main className="flex items-center justify-center p-8">
      <NewSlaTargetForm categoryNames={categories.map((c) => c.name)} />
    </main>
  );
}
