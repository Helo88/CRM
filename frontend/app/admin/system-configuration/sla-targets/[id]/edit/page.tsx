import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { EditSlaTargetForm } from "./EditSlaTargetForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminSlaTargets");
  return { title: t("editTitle"), robots: { index: false, follow: false } };
}

interface SlaTargetRow {
  id: string;
  priority: "low" | "medium" | "high" | "urgent" | null;
  category: string | null;
  responseMinutes: number;
  resolutionMinutes: number;
  isDefault: boolean;
}

export default async function EditSlaTargetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ _refreshed?: string }>;
}) {
  const { id } = await params;
  const { _refreshed } = await searchParams;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!accessToken) {
    if (hasRefreshToken && !_refreshed) {
      redirect(`/api/session/refresh?next=/admin/system-configuration/sla-targets/${id}/edit`);
    }
    redirect("/");
  }

  const { role, permissions = [] } = peekJwtPayload(accessToken);
  if (role !== "admin" && !permissions.includes("sla:targets_edit")) {
    redirect("/dashboard");
  }

  // No single-target GET route exists (mirrors ticket categories, which
  // edits from the row's already-fetched data too) — the list is tiny by
  // design (see slaTarget.routes.ts's own comment), so fetching it here and
  // finding the row is cheap and avoids a redundant backend endpoint.
  const [targetsRes, categoriesRes] = await Promise.all([
    fetch(`${API_URL}/api/v1/sla-targets`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }),
    fetch(`${API_URL}/api/v1/ticket-categories?active=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }),
  ]);

  if (targetsRes.status === 403) redirect("/dashboard");
  if (!targetsRes.ok) redirect("/");

  const targets: SlaTargetRow[] = await targetsRes.json();
  const target = targets.find((t) => t.id === id);
  if (!target) notFound();

  const categories: { id: string; name: string }[] = categoriesRes.ok ? await categoriesRes.json() : [];

  return (
    <main className="flex items-center justify-center p-8">
      <EditSlaTargetForm target={target} categoryNames={categories.map((c) => c.name)} />
    </main>
  );
}
