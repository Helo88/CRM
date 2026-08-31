"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleDot, ArrowDownUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FilterField } from "@/components/FilterField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";

// Server-driven filtering, same pattern as tickets/TicketFilterBar.tsx —
// every control rewrites the URL's query params (?isActive=&sort=), reset to
// page 1 on any change, no client-held filter state. `q` (text search) isn't
// a control here — it's set by HeaderSearch's "search this page" action; this
// bar only surfaces it as an active-filter chip so it can be cleared.
export function CustomerFilterBar() {
  const t = useTranslations("CustomersList");
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = searchParams.get("isActive") ?? ALL;
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
    router.push(`/customers?${params.toString()}`);
  }

  function clearSearch() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("page");
    router.push(`/customers?${params.toString()}`);
  }

  const hasActiveFilter = status !== ALL || Boolean(q);

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

      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground sm:w-auto"
          onClick={() => router.push("/customers")}
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
