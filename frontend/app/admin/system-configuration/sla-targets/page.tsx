import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { RowActions } from "./RowActions";
import { SettingsCard } from "./SettingsCard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminSlaTargets");
  return { title: t("title"), robots: { index: false, follow: false } };
}

interface SlaTargetRow {
  id: string;
  priority: "low" | "medium" | "high" | "urgent" | null;
  category: string | null;
  responseMinutes: number;
  resolutionMinutes: number;
  isDefault: boolean;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${Math.floor(hours)}h ${minutes % 60}m`;
}

const PRIORITY_BADGE_CLASS: Record<string, string> = {
  low: "border-transparent bg-muted text-muted-foreground",
  medium: "border-transparent bg-primary/10 text-primary",
  high: "border-transparent bg-warning/15 text-warning",
  urgent: "border-transparent bg-destructive/10 text-destructive",
};

// sla-automation Story 25 — the "SLA Targets" tab of the
// /admin/system-configuration shell (see ../layout.tsx). Two write
// permissions gate two independent things on this one page:
// sla:targets_view/sla:targets_edit gate the target rows below; sla:configure
// gates the monitor-settings card above them — a sub-admin could hold one
// without the other.
export default async function AdminSlaTargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ _refreshed?: string }>;
}) {
  const { _refreshed } = await searchParams;
  const t = await getTranslations("AdminSlaTargets");

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!token) {
    if (hasRefreshToken && !_refreshed) {
      redirect("/api/session/refresh?next=/admin/system-configuration/sla-targets");
    }
    redirect("/");
  }

  const [targetsRes, settingsRes] = await Promise.all([
    fetch(`${API_URL}/api/v1/sla-targets`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
    fetch(`${API_URL}/api/v1/sla-targets/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
  ]);

  if (targetsRes.status === 401) {
    if (!_refreshed) {
      redirect("/api/session/refresh?next=/admin/system-configuration/sla-targets");
    }
    redirect("/login");
  }

  // sla:targets_view gates the list itself — a viewer without it never gets
  // a working link to this tab (see lib/staffNav.ts's note on the
  // consolidated systemConfiguration entry), so reaching it and being
  // turned away belongs on the dashboard, not a dead-end message.
  if (targetsRes.status === 403) {
    redirect("/dashboard");
  }
  if (!targetsRes.ok) {
    redirect("/");
  }

  const targets: SlaTargetRow[] = await targetsRes.json();

  // sla:configure is a *separate* permission from sla:targets_view/edit — a
  // caller can legitimately reach this tab without it. The settings fetch
  // 403ing is expected in that case, not a page-level error: fall back to
  // the same defaults getSlaSystemSettings() itself uses, rendered disabled.
  const settings = settingsRes.ok
    ? ((await settingsRes.json()) as { atRiskPercent: number; scanIntervalMinutes: number })
    : { atRiskPercent: 75, scanIntervalMinutes: 1 };

  const { role: viewerRole, permissions: viewerPermissions = [] } = peekJwtPayload(token);
  const isViewerAdmin = viewerRole === "admin";
  const canEditTargets = isViewerAdmin || viewerPermissions.includes("sla:targets_edit");
  const canConfigure = isViewerAdmin || viewerPermissions.includes("sla:configure");

  return (
    <div>
      <SettingsCard
        initialAtRiskPercent={settings.atRiskPercent}
        initialScanIntervalMinutes={settings.scanIntervalMinutes}
        canEdit={canConfigure}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        {canEditTargets && (
          <Button asChild size="sm">
            <Link href="/admin/system-configuration/sla-targets/new">{t("newButton")}</Link>
          </Button>
        )}
      </div>

      {targets.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          {/* Mobile (< md): stacked cards, same pattern as the categories tab. */}
          <div className="flex flex-col gap-3 md:hidden">
            {targets.map((row) => (
              <div key={row.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    {row.priority ? (
                      <Badge className={PRIORITY_BADGE_CLASS[row.priority]}>{t(`priority.${row.priority}`)}</Badge>
                    ) : (
                      <span className="italic text-muted-foreground">{t("anyLabel")}</span>
                    )}
                    {row.category ?? <span className="italic text-muted-foreground">{t("anyLabel")}</span>}
                  </span>
                  {row.isDefault && (
                    <Badge variant="outline" className="shrink-0 border-transparent bg-success/10 text-success">
                      {t("defaultBadge")}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex gap-2 text-sm text-muted-foreground">
                  <span>
                    {t("columns.response")}: {formatMinutes(row.responseMinutes)}
                  </span>
                  <span>&middot;</span>
                  <span>
                    {t("columns.resolution")}: {formatMinutes(row.resolutionMinutes)}
                  </span>
                </div>
                {canEditTargets && (
                  <div className="mt-3 flex items-center justify-end border-t border-border pt-3">
                    <RowActions targetId={row.id} isDefault={row.isDefault} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* md and up: the real table. */}
          <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.priority")}</TableHead>
                  <TableHead>{t("columns.category")}</TableHead>
                  <TableHead>{t("columns.response")}</TableHead>
                  <TableHead>{t("columns.resolution")}</TableHead>
                  <TableHead>{t("columns.default")}</TableHead>
                  {canEditTargets && <TableHead className="text-end">{t("columns.actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.priority ? (
                        <Badge className={PRIORITY_BADGE_CLASS[row.priority]}>{t(`priority.${row.priority}`)}</Badge>
                      ) : (
                        <span className="italic text-muted-foreground">{t("anyLabel")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.category ?? <span className="italic text-muted-foreground">{t("anyLabel")}</span>}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatMinutes(row.responseMinutes)}</TableCell>
                    <TableCell className="tabular-nums">{formatMinutes(row.resolutionMinutes)}</TableCell>
                    <TableCell>
                      {row.isDefault && (
                        <Badge variant="outline" className="border-transparent bg-success/10 text-success">
                          {t("defaultBadge")}
                        </Badge>
                      )}
                    </TableCell>
                    {canEditTargets && (
                      <TableCell>
                        <RowActions targetId={row.id} isDefault={row.isDefault} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
