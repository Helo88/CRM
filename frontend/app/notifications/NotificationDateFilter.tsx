"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/DatePickerField";

// Mirrors TicketFilterBar's server-driven convention: every control just
// rewrites the URL's ?from=&to= query params (reset to page 1 on any
// change) and the page.tsx Server Component re-fetches — no client-held
// filter state (the popover's own open/closed state is the only thing kept
// client-side).
export function NotificationDateFilter() {
  const t = useTranslations("NotificationsPage");
  const router = useRouter();
  const searchParams = useSearchParams();

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const fromDate = from ? new Date(`${from}T00:00:00`) : undefined;
  const toDate = to ? new Date(`${to}T00:00:00`) : undefined;

  function updateParam(key: "from" | "to", value: Date | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, format(value, "yyyy-MM-dd"));
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/notifications?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card/50 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5 sm:gap-y-3 sm:p-4">
      <DatePickerField
        id="notifications-from"
        label={t("filterFrom")}
        value={fromDate}
        maxDate={toDate}
        onChange={(v) => updateParam("from", v)}
      />
      <DatePickerField
        id="notifications-to"
        label={t("filterTo")}
        value={toDate}
        minDate={fromDate}
        onChange={(v) => updateParam("to", v)}
      />
      {(from || to) && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground sm:w-auto"
          onClick={() => router.push("/notifications")}
        >
          <X className="size-3.5" />
          {t("resetFilters")}
        </Button>
      )}
    </div>
  );
}
