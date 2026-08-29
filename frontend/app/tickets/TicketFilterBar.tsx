"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleDot, Tag, Flag, ArrowDownUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";

interface TicketFilterBarProps {
  categories: string[];
}

// Story 60: server-driven filtering — every control just rewrites the URL's
// query params (?status=&category=&priority=&sort=), reset to page 1 on any
// change, and the page.tsx Server Component re-fetches with the new params.
// No client-held filter state, matching the intake's "server-driven, no
// client state" note.
export function TicketFilterBar({ categories }: TicketFilterBarProps) {
  const t = useTranslations("Tickets");
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? ALL;
  const category = searchParams.get("category") ?? ALL;
  const priority = searchParams.get("priority") ?? ALL;
  const sort = searchParams.get("sort") ?? "-updatedAt";

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

  const hasActiveFilter = status !== ALL || category !== ALL || priority !== ALL;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card/50 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5 sm:gap-y-3 sm:p-4">
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

      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground sm:w-auto"
          onClick={() => router.push("/tickets")}
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
            <SelectItem value="-updatedAt">{t("sortUpdatedDesc")}</SelectItem>
            <SelectItem value="updatedAt">{t("sortUpdatedAsc")}</SelectItem>
            <SelectItem value="status">{t("sortStatus")}</SelectItem>
            <SelectItem value="category">{t("sortCategory")}</SelectItem>
            <SelectItem value="priority">{t("sortPriority")}</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
    </div>
  );
}

function FilterField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex w-full flex-col gap-1 sm:w-auto", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
