"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { SlidersHorizontal, CircleDot, Tag, Flag, Inbox, CalendarRange, ArrowDownUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FilterField } from "@/components/FilterField";
import { DatePickerField } from "@/components/DatePickerField";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";

const STATUS_KEY: Record<string, string> = {
  new: "statusNew",
  in_progress: "statusInProgress",
  answered: "statusAnswered",
  escalated: "statusEscalated",
  closed: "statusClosed",
};

const PRIORITY_KEY: Record<string, string> = {
  low: "priorityLow",
  medium: "priorityMedium",
  high: "priorityHigh",
  urgent: "priorityUrgent",
};

const SOURCE_KEY: Record<string, string> = {
  customer_portal: "sourceCustomer",
  phone: "sourceStaffPhone",
  email: "sourceStaffEmail",
  in_person: "sourceStaffInPerson",
  other: "sourceStaffOther",
};

interface TicketFilterBarProps {
  categories: string[];
}

// A single "Filters" trigger opening a full-screen panel (Concept C, picked
// 2026-09-01 over two other layout sketches; a small anchored popover was
// tried first but its narrow width forced the date-range fields to overflow
// — full screen gives the two-column layout the room it needs) instead of
// every Select sitting inline in the header — keeps the queue header calm
// regardless of how many filters exist, and leaves room for future ones
// without the row growing. Applied filters still surface as removable
// chips below the header so state stays visible without opening the panel.
// `q` (text search) isn't a control inside the panel — it's set by
// HeaderSearch's "search this page" action — but it does get its own
// removable chip, same as every other active filter.
//
// Server-driven filtering, same convention as before: every control
// rewrites the URL's query params, resets to page 1 on any change, no
// client-held filter state except the panel's own open/closed flag.
export function TicketFilterBar({ categories }: TicketFilterBarProps) {
  const t = useTranslations("Tickets");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [panelOpen, setPanelOpen] = useState(false);

  const status = searchParams.get("status") ?? ALL;
  const category = searchParams.get("category") ?? ALL;
  const priority = searchParams.get("priority") ?? ALL;
  const createdVia = searchParams.get("createdVia") ?? ALL;
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

  function clearRange(fromKey: string, toKey: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(fromKey);
    params.delete(toKey);
    params.delete("page");
    router.push(`/tickets?${params.toString()}`);
  }

  function clearSearch() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("page");
    router.push(`/tickets?${params.toString()}`);
  }

  function rangeLabel(from?: Date, to?: Date) {
    if (from && to) return `${format(from, "MMM d")} → ${format(to, "MMM d")}`;
    if (from) return `${t("filterDateFrom")} ${format(from, "MMM d")}`;
    return `${t("filterDateTo")} ${format(to as Date, "MMM d")}`;
  }

  const activeCount = [
    status !== ALL,
    category !== ALL,
    priority !== ALL,
    createdVia !== ALL,
    Boolean(createdFrom || createdTo),
    Boolean(updatedFrom || updatedTo),
  ].filter(Boolean).length;
  const hasActiveFilter = activeCount > 0 || Boolean(q);

  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (q) chips.push({ key: "q", label: `${t("filterSearch")}: ${t("searchingFor", { query: q })}`, onRemove: clearSearch });
  if (status !== ALL) {
    chips.push({
      key: "status",
      label: `${t("filterStatus")}: ${t(STATUS_KEY[status])}`,
      onRemove: () => updateParam("status", ALL),
    });
  }
  if (category !== ALL) {
    chips.push({ key: "category", label: `${t("filterCategory")}: ${category}`, onRemove: () => updateParam("category", ALL) });
  }
  if (priority !== ALL) {
    chips.push({
      key: "priority",
      label: `${t("filterPriority")}: ${t(PRIORITY_KEY[priority])}`,
      onRemove: () => updateParam("priority", ALL),
    });
  }
  if (createdVia !== ALL) {
    chips.push({
      key: "createdVia",
      label: `${t("filterSource")}: ${t(SOURCE_KEY[createdVia])}`,
      onRemove: () => updateParam("createdVia", ALL),
    });
  }
  if (createdFrom || createdTo) {
    chips.push({
      key: "created",
      label: `${t("filterCreated")}: ${rangeLabel(createdFromDate, createdToDate)}`,
      onRemove: () => clearRange("createdFrom", "createdTo"),
    });
  }
  if (updatedFrom || updatedTo) {
    chips.push({
      key: "updated",
      label: `${t("filterUpdated")}: ${rangeLabel(updatedFromDate, updatedToDate)}`,
      onRemove: () => clearRange("updatedFrom", "updatedTo"),
    });
  }

  return (
    <div className="mb-4 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card/50 p-3 sm:p-4">
        <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-2", activeCount > 0 && "border-primary/50 bg-primary/5 text-primary")}
            >
              <SlidersHorizontal className="size-3.5" />
              {t("filtersLabel")}
              {activeCount > 0 && (
                <span className="flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </Button>
          </DialogTrigger>
          {/* Mobile: full-screen (h-dvh) — a small anchored popover forced
              the two date-range fields into a narrow column too tight for
              both to sit side-by-side (they overflowed, worst in Arabic
              where longer labels pushed it past the edge), and there's no
              room for a top-anchored panel on a small screen anyway.
              Desktop (sm+): full-width but content-height, top-anchored —
              a banner/dropdown, not a full-height takeover; matches the
              original design concept, which was never meant to fill the
              whole viewport height on a wide screen. */}
          <DialogContent
            showCloseButton={false}
            className="top-0 start-0 flex h-auto max-sm:h-dvh w-screen max-sm:w-[80%] max-w-none translate-x-0 rtl:translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-none sm:rounded-b-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-10">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="size-4 text-primary" />
                <DialogTitle>{t("filtersLabel")}</DialogTitle>
              </div>
              <DialogClose asChild>
                <Button variant="ghost" size="icon-sm">
                  <X className="size-4" />
                  <span className="sr-only">{t("done")}</span>
                </Button>
              </DialogClose>
            </div>

            {/* flex-1 (flex-basis: 0%) fills the screen on mobile. At sm+,
                sm:flex-none switches it to natural content-based sizing —
                merely zeroing flex-grow (sm:grow-0) was NOT enough, since
                flex-basis stayed 0% and min-h-0 let it collapse to near
                nothing, silently scroll-clipping the real ~300px of content
                into an invisible sliver. overflow-y-auto only kicks in if
                content genuinely exceeds available space either way. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:flex-none sm:px-10">
              <div className="mx-auto grid max-w-3xl gap-x-12 gap-y-8 sm:grid-cols-2">
                <div className="flex flex-col gap-5">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {t("filterGroupAttributes")}
                  </p>

                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <CircleDot className="size-3.5 text-icon-status" />
                      {t("filterStatus")}
                    </label>
                    <Select value={status} onValueChange={(v) => updateParam("status", v)}>
                      <SelectTrigger className="w-full">
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

                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Tag className="size-3.5 text-icon-category" />
                      {t("filterCategory")}
                    </label>
                    <Select value={category} onValueChange={(v) => updateParam("category", v)}>
                      <SelectTrigger className="w-full">
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
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Flag className="size-3.5 text-icon-priority" />
                      {t("filterPriority")}
                    </label>
                    <Select value={priority} onValueChange={(v) => updateParam("priority", v)}>
                      <SelectTrigger className="w-full">
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
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Inbox className="size-3.5 text-icon-source" />
                      {t("filterSource")}
                    </label>
                    <Select value={createdVia} onValueChange={(v) => updateParam("createdVia", v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>{t("filterAll")}</SelectItem>
                        <SelectItem value="customer_portal">{t("sourceCustomer")}</SelectItem>
                        <SelectItem value="phone">{t("sourceStaffPhone")}</SelectItem>
                        <SelectItem value="email">{t("sourceStaffEmail")}</SelectItem>
                        <SelectItem value="in_person">{t("sourceStaffInPerson")}</SelectItem>
                        <SelectItem value="other">{t("sourceStaffOther")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {t("filterGroupDates")}
                  </p>

                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <CalendarRange className="size-3.5 text-icon-date" />
                      {t("filterCreated")}
                    </label>
                    <div className="flex items-center gap-2">
                      <DatePickerField
                        id="tickets-created-from"
                        className="flex-1 sm:w-auto"
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
                        className="flex-1 sm:w-auto"
                        placeholder={t("filterDateTo")}
                        value={createdToDate}
                        minDate={createdFromDate}
                        onChange={(v) => updateDateParam("createdTo", v)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <CalendarRange className="size-3.5 text-icon-date" />
                      {t("filterUpdated")}
                    </label>
                    <div className="flex items-center gap-2">
                      <DatePickerField
                        id="tickets-updated-from"
                        className="flex-1 sm:w-auto"
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
                        className="flex-1 sm:w-auto"
                        placeholder={t("filterDateTo")}
                        value={updatedToDate}
                        minDate={updatedFromDate}
                        onChange={(v) => updateDateParam("updatedTo", v)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border px-5 py-4 sm:px-10">
              {activeCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => router.push("/tickets")}
                >
                  <X className="size-3.5" />
                  {t("resetFilters")}
                </Button>
              ) : (
                <span />
              )}
              <Button size="sm" onClick={() => setPanelOpen(false)}>
                {t("done")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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

      {hasActiveFilter && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="group flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/8 py-1 pe-2 ps-3 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            >
              {chip.label}
              <X className="size-3 opacity-70 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
