"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleDot, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";

// Story 60 (customer-portal Story 36): the one filter a customer gets on
// their own ticket list — status only. Category/priority/sort stay
// staff-facing triage concepts (see StaffTicketQueue's TicketFilterBar).
export function CustomerStatusFilter() {
  const t = useTranslations("Tickets");
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? ALL;

  function updateStatus(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `/tickets?${query}` : "/tickets");
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card/50 p-3">
      <div className="flex w-full flex-col gap-1 sm:w-auto">
        <span className="text-xs font-medium text-muted-foreground">{t("filterStatus")}</span>
        <Select value={status} onValueChange={updateStatus}>
          <SelectTrigger
            className={cn("w-full sm:w-44", status !== ALL && "border-primary/50 bg-primary/5 text-primary")}
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
      </div>

      {status !== ALL && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground sm:w-auto"
          onClick={() => updateStatus(ALL)}
        >
          <X className="size-3.5" />
          {t("resetFilters")}
        </Button>
      )}
    </div>
  );
}
