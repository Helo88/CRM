"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleDot, ShieldUser, Wifi, ArrowDownUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FilterField } from "@/components/FilterField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";

// Server-driven filtering, same pattern as tickets/TicketFilterBar.tsx and
// customers/CustomerFilterBar.tsx. `q` isn't a control here — see
// CustomerFilterBar's comment for why.
export function AdminUsersFilterBar() {
  const t = useTranslations("AdminUsersList");
  const router = useRouter();
  const searchParams = useSearchParams();

  const role = searchParams.get("role") ?? ALL;
  const status = searchParams.get("isActive") ?? ALL;
  const online = searchParams.get("isOnline") ?? ALL;
  const sort = searchParams.get("sort") ?? "-createdAt";
  const q = searchParams.get("q");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    router.push(`/admin/users?${params.toString()}`);
  }

  function clearSearch() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("page");
    router.push(`/admin/users?${params.toString()}`);
  }

  const hasActiveFilter = role !== ALL || status !== ALL || online !== ALL || Boolean(q);

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card/50 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5 sm:gap-y-3 sm:p-4">
      {q && (
        <FilterField label={t("filterSearch")}>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between border-primary/50 bg-primary/5 text-primary sm:w-auto"
            onClick={clearSearch}
          >
            <span className="max-w-40 truncate">{t("searchingFor", { query: q })}</span>
            <X className="size-3.5" />
          </Button>
        </FilterField>
      )}

      <FilterField label={t("filterRole")}>
        <Select value={role} onValueChange={(v) => updateParam("role", v)}>
          <SelectTrigger
            className={cn("w-full sm:w-[9.5rem]", role !== ALL && "border-primary/50 bg-primary/5 text-primary")}
            size="sm"
          >
            <ShieldUser className={cn("size-3.5", role !== ALL ? "text-primary" : "text-muted-foreground")} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filterAll")}</SelectItem>
            <SelectItem value="agent">{t("roleAgent")}</SelectItem>
            <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
            <SelectItem value="subadmin">{t("roleSubadmin")}</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label={t("filterStatus")}>
        <Select value={status} onValueChange={(v) => updateParam("isActive", v)}>
          <SelectTrigger
            className={cn("w-full sm:w-[9.5rem]", status !== ALL && "border-primary/50 bg-primary/5 text-primary")}
            size="sm"
          >
            <CircleDot className={cn("size-3.5", status !== ALL ? "text-primary" : "text-muted-foreground")} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filterAll")}</SelectItem>
            <SelectItem value="true">{t("statusActive")}</SelectItem>
            <SelectItem value="false">{t("statusInactive")}</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label={t("filterOnline")}>
        <Select value={online} onValueChange={(v) => updateParam("isOnline", v)}>
          <SelectTrigger
            className={cn("w-full sm:w-[9.5rem]", online !== ALL && "border-primary/50 bg-primary/5 text-primary")}
            size="sm"
          >
            <Wifi className={cn("size-3.5", online !== ALL ? "text-primary" : "text-muted-foreground")} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filterAll")}</SelectItem>
            <SelectItem value="true">{t("onlineYes")}</SelectItem>
            <SelectItem value="false">{t("onlineNo")}</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground sm:w-auto"
          onClick={() => router.push("/admin/users")}
        >
          <X className="size-3.5" />
          {t("resetFilters")}
        </Button>
      )}

      <FilterField label={t("sortLabel")} className="sm:ms-auto">
        <Select value={sort} onValueChange={(v) => updateParam("sort", v)}>
          <SelectTrigger className="w-full sm:w-52" size="sm">
            <ArrowDownUp className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-createdAt">{t("sortJoinedDesc")}</SelectItem>
            <SelectItem value="createdAt">{t("sortJoinedAsc")}</SelectItem>
            <SelectItem value="name">{t("sortNameAsc")}</SelectItem>
            <SelectItem value="-name">{t("sortNameDesc")}</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
    </div>
  );
}
