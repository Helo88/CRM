"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Mirrors TicketFilterBar's server-driven convention: every control just
// rewrites the URL's ?from=&to= query params (reset to page 1 on any
// change) and the page.tsx Server Component re-fetches — no client-held
// filter state.
export function NotificationDateFilter() {
  const t = useTranslations("NotificationsPage");
  const router = useRouter();
  const searchParams = useSearchParams();

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  function updateParam(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/notifications?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card/50 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5 sm:gap-y-3 sm:p-4">
      <div className="flex w-full flex-col gap-1 sm:w-auto">
        <Label htmlFor="notifications-from" className="text-xs font-medium text-muted-foreground">
          {t("filterFrom")}
        </Label>
        <Input
          id="notifications-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => updateParam("from", e.target.value)}
          className="w-full sm:w-40"
        />
      </div>
      <div className="flex w-full flex-col gap-1 sm:w-auto">
        <Label htmlFor="notifications-to" className="text-xs font-medium text-muted-foreground">
          {t("filterTo")}
        </Label>
        <Input
          id="notifications-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => updateParam("to", e.target.value)}
          className="w-full sm:w-40"
        />
      </div>
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
