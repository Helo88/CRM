import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, ShieldUser, BarChart3, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { StaffSidebar } from "@/components/StaffSidebar";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

// Staff landing page — no backend call of its own, just navigation into the
// two staff areas that exist today. Not shown to customers: there's no
// natural 403 to lean on here (unlike /customers or /admin/users), so the
// role check happens directly against the access token, same pattern as
// customers/new/page.tsx.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ _refreshed?: string }>;
}) {
  const { _refreshed } = await searchParams;
  const t = await getTranslations("Dashboard");
  const tNav = await getTranslations("Nav");

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!accessToken) {
    if (hasRefreshToken && !_refreshed) {
      redirect("/api/session/refresh?next=/dashboard");
    }
    redirect("/");
  }

  const { role, name, permissions = [] } = peekJwtPayload(accessToken);
  const isStaff = role === "agent" || role === "admin" || role === "subadmin";
  if (!isStaff) {
    redirect("/");
  }
  // Mirrors the actual route gates: agent/admin always reach /customers,
  // a sub-admin only with a customers:manage delegation (see
  // backend/src/routes/customer.routes.ts's staffOrDelegatedSubadmin);
  // /admin/users needs staff:view_list, which only admin or a delegated
  // sub-admin can ever hold (see SUBADMIN_ONLY_PERMISSIONS). Showing a tile
  // a viewer can't actually use would just bounce them right back here.
  const canViewCustomers = role === "agent" || role === "admin" || permissions.includes("customers:manage");
  const canViewAccounts = role === "admin" || permissions.includes("staff:view_list");

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar active="dashboard" />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-7">
          <h1 className="text-2xl font-extrabold tracking-tight text-balance">
            {t("greeting", { name: name?.split(" ")[0] || "" })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subheading")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canViewCustomers && (
            <Link
              href="/customers"
              className="group/tile relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-2xl border border-border p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
              style={{ background: "linear-gradient(150deg, color-mix(in oklch, var(--primary) 14%, var(--card)), var(--card))" }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-8 -end-8 size-36 rounded-full opacity-50"
                style={{ background: "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--primary) 55%, transparent), transparent 70%)" }}
              />
              <div
                className="grid size-10 place-items-center rounded-xl"
                style={{ background: "color-mix(in oklch, var(--primary) 20%, var(--card))", color: "var(--primary)" }}
              >
                <Users className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">{tNav("customers")}</h2>
                <p className="mt-0.5 max-w-[30ch] text-sm text-muted-foreground">{t("customersTileBody")}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("customersTileNote")}</span>
                <span className="grid size-8 place-items-center rounded-full border border-border bg-card text-foreground transition-transform group-hover/tile:translate-x-0.5 rtl:group-hover/tile:-translate-x-0.5">
                  <ArrowRight className="size-3.5 rtl:-scale-x-100" />
                </span>
              </div>
            </Link>
          )}

          {canViewAccounts && (
            <Link
              href="/admin/users"
              className="group/tile relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-2xl border border-border p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
              style={{ background: "linear-gradient(150deg, color-mix(in oklch, var(--chart-2) 12%, var(--card)), var(--card))" }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-8 -end-8 size-36 rounded-full opacity-50"
                style={{ background: "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--chart-2) 50%, transparent), transparent 70%)" }}
              />
              <div
                className="grid size-10 place-items-center rounded-xl"
                style={{ background: "color-mix(in oklch, var(--chart-2) 20%, var(--card))", color: "var(--chart-2)" }}
              >
                <ShieldUser className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">{tNav("accounts")}</h2>
                <p className="mt-0.5 max-w-[30ch] text-sm text-muted-foreground">{t("accountsTileBody")}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("accountsTileNote")}</span>
                <span className="grid size-8 place-items-center rounded-full border border-border bg-card text-foreground transition-transform group-hover/tile:translate-x-0.5 rtl:group-hover/tile:-translate-x-0.5">
                  <ArrowRight className="size-3.5 rtl:-scale-x-100" />
                </span>
              </div>
            </Link>
          )}

          <div className="relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-2xl border border-dashed border-border p-5 opacity-70">
            <div className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
              <BarChart3 className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">{t("reportsTileTitle")}</h2>
              <p className="mt-0.5 max-w-[30ch] text-sm text-muted-foreground">{t("reportsTileBody")}</p>
            </div>
            <span className="text-xs text-muted-foreground">{t("comingLater")}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
