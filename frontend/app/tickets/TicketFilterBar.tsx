"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { CircleDot, Tag, Flag, ArrowDownUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FilterField } from "@/components/FilterField";
import { DatePickerField } from "@/components/DatePickerField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";

interface TicketFilterBarProps {
  categories: string[];
}

// Story 60: server-driven filtering — every control just rewrites the URL's
// query params (?status=&category=&priority=&sort=), reset to page 1 on any
// change, and the page.tsx Server Component re-fetches with the new params.
// No client-held filter state, matching the intake's "server-driven, no
// client state" note. `q` (text search) isn't a control here — it's set by
// HeaderSearch's "search this page" action; this bar only surfaces it as an
// active-filter chip so it can be cleared, same convention as
// CustomerFilterBar/AdminUsersFilterBar.
export function TicketFilterBar({ categories }: TicketFilterBarProps) {
  const t = useTranslations("Tickets");
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? ALL;
  const category = searchParams.get("category") ?? ALL;
  const priority = searchParams.get("priority") ?? ALL;
  const sort = searchParams.get("sort") ?? "-updatedAt";
  const q = searchParams.get("q");

  const createdFrom = searchParams.get("createdFrom") ?? "";
  const createdTo = searchParams.get("createdTo") ?? "";
  const updatedFrom = searchParams.get("updatedFrom") ?? "";
  const updatedTo = searchParams.get("updatedTo") ?? "";
  const createdFromDate = createdFrom ? new Date(`${createdFrom}T00:00:00`) : undefined;
  const createdToDate = createdTo ? new Date(`${createdTo}T00:00:00`) : undefined;
  const updatedFromDate = updatedFrom ? new Date(`${updatedFrom}T00:00:00`) : undefined;
  const updatedToDate = updatedTo ? new Date(`${updatedTo}T00:00:00`) : undefined;

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    router.push(`/tickets?${params.toString()}`);
  }

  function updateDateParam(key: "createdFrom" | "createdTo" | "updatedFrom" | "updatedTo", value: Date | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, format(value, "yyyy-MM-dd"));
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/tickets?${params.toString()}`);
  }

  function clearSearch() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("page");
    router.push(`/tickets?${params.toString()}`);
  }

  const hasActiveFilter =
    status !== ALL ||
    category !== ALL ||
    priority !== ALL ||
    Boolean(q) ||
    Boolean(createdFrom || createdTo || updatedFrom || updatedTo);

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card/50 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5 sm:gap-y-3">
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
          <Select value={status} onValueChange={(v) => updateParam("status", v)}>
            <SelectTrigger
              className={cn("w-full sm:w-[9.5rem]", status !== ALL && "border-primary/50 bg-primary/5 text-primary")}
              size="sm"
            >
              <CircleDot className={cn("size-3.5", status !== ALL ? "text-primary" : "text-muted-foreground")} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filterAll")}</SelectItem>
              <SelectItem value="new">{t("statusNew")}</SelectItem>
              <SelectItem value="in_progress">{t("statusInProgress")}</SelectItem>
              <SelectItem value="answered">{t("statusAnswered")}</SelectItem>
              <SelectItem value="escalated">{t("statusEscalated")}</SelectItem>
              <SelectItem value="closed">{t("statusClosed")}</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label={t("filterCategory")}>
          <Select value={category} onValueChange={(v) => updateParam("category", v)}>
            <SelectTrigger
              className={cn("w-full sm:w-[9.5rem]", category !== ALL && "border-primary/50 bg-primary/5 text-primary")}
              size="sm"
            >
              <Tag className={cn("size-3.5", category !== ALL ? "text-primary" : "text-muted-foreground")} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filterAll")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label={t("filterPriority")}>
          <Select value={priority} onValueChange={(v) => updateParam("priority", v)}>
            <SelectTrigger
              className={cn("w-full sm:w-[8.5rem]", priority !== ALL && "border-primary/50 bg-primary/5 text-primary")}
              size="sm"
            >
              <Flag className={cn("size-3.5", priority !== ALL ? "text-primary" : "text-muted-foreground")} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filterAll")}</SelectItem>
              <SelectItem value="low">{t("priorityLow")}</SelectItem>
              <SelectItem value="medium">{t("priorityMedium")}</SelectItem>
              <SelectItem value="high">{t("priorityHigh")}</SelectItem>
              <SelectItem value="urgent">{t("priorityUrgent")}</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label={t("filterCreated")}>
          <div className="flex items-center gap-1.5">
            <DatePickerField
              id="tickets-created-from"
              className="sm:w-32"
              placeholder={t("filterDateFrom")}
              value={createdFromDate}
              maxDate={createdToDate}
              onChange={(v) => updateDateParam("createdFrom", v)}
            />
            <span className="text-xs text-muted-foreground" aria-hidden>
              –
            </span>
            <DatePickerField
              id="tickets-created-to"
              className="sm:w-32"
              placeholder={t("filterDateTo")}
              value={createdToDate}
              minDate={createdFromDate}
              onChange={(v) => updateDateParam("createdTo", v)}
            />
          </div>
        </FilterField>

        <FilterField label={t("filterUpdated")}>
          <div className="flex items-center gap-1.5">
            <DatePickerField
              id="tickets-updated-from"
              className="sm:w-32"
              placeholder={t("filterDateFrom")}
              value={updatedFromDate}
              maxDate={updatedToDate}
              onChange={(v) => updateDateParam("updatedFrom", v)}
            />
            <span className="text-xs text-muted-foreground" aria-hidden>
              –
            </span>
            <DatePickerField
              id="tickets-updated-to"
              className="sm:w-32"
              placeholder={t("filterDateTo")}
              value={updatedToDate}
              minDate={updatedFromDate}
              onChange={(v) => updateDateParam("updatedTo", v)}
            />
          </div>
        </FilterField>

        <FilterField label={t("sortLabel")} className="sm:ms-auto">
          <Select value={sort} onValueChange={(v) => updateParam("sort", v)}>
            <SelectTrigger className="w-full sm:w-52" size="sm">
              <ArrowDownUp className="size-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-updatedAt">{t("sortUpdatedDesc")}</SelectItem>
              <SelectItem value="updatedAt">{t("sortUpdatedAsc")}</SelectItem>
              <SelectItem value="status">{t("sortStatus")}</SelectItem>
              <SelectItem value="category">{t("sortCategory")}</SelectItem>
              <SelectItem value="priority">{t("sortPriority")}</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </div>

      {/* Its own row, outside the filters/sort wrap flow above, so toggling
          it on/off can never reflow those controls' line-wrapping (it used
          to be a mid-row flex item, so appearing/disappearing shifted
          sort/filters to a different line depending on available width). */}
      {hasActiveFilter && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => router.push("/tickets")}
          >
            <X className="size-3.5" />
            {t("resetFilters")}
          </Button>
        </div>
      )}
    </div>
  );
}
