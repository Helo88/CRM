"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

// Mirrors TicketFilterBar's server-driven convention: every control just
// rewrites the URL's ?from=&to= query params (reset to page 1 on any
// change) and the page.tsx Server Component re-fetches — no client-held
// filter state (the popover's own open/closed state is the only thing kept
// client-side).
//
// A themed Calendar popover instead of a native <input type="date"> — the
// native control's own picker is unstyleable browser/OS chrome that ignored
// dark mode entirely (a plain white calendar popup). The Calendar component
// already carries this app's tokens (bg-popover, bg-primary, etc.) and RTL
// chevron flipping, so it follows the theme and layout direction for free.
// Month/day names stay English-only for now regardless of locale — the
// component takes a react-day-picker `locale` (from date-fns/locale) to
// localize those, deliberately not wired up yet.
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

function DatePickerField({
  id,
  label,
  value,
  minDate,
  maxDate,
  onChange,
}: {
  id: string;
  label: string;
  value: Date | undefined;
  minDate?: Date;
  maxDate?: Date;
  onChange: (value: Date | undefined) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-1 sm:w-auto">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            size="sm"
            className={cn("w-full justify-start gap-2 sm:w-40", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="size-3.5 shrink-0" />
            {value ? format(value, "MMM d, yyyy") : "—"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            disabled={(date) => (minDate ? date < minDate : false) || (maxDate ? date > maxDate : false)}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
