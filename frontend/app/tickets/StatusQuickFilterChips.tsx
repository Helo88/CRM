"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { StaffTicketRow } from "./StaffTicketQueue";

type Status = StaffTicketRow["status"];

const STATUS_ORDER: Status[] = ["new", "in_progress", "answered", "escalated", "closed"];

const STATUS_KEY: Record<Status, string> = {
  new: "statusNew",
  in_progress: "statusInProgress",
  answered: "statusAnswered",
  escalated: "statusEscalated",
  closed: "statusClosed",
};

// The exact success/warning/destructive tint STATUS_BADGE_CLASS
// (StaffTicketQueue.tsx) already uses on the table's status Badge —
// `bg-x/10 text-x`, not a solid fill. Reusing that pattern rather than a
// solid one matters specifically in light mode: this app's warning/success
// tokens are deliberately dark/saturated colors meant to be read as *text*
// on a light tint (that's how the badge already uses them), not as a big
// solid fill — filling a whole pill with the raw token turns it into a
// muddy block in light mode, even though the same token reads fine as a
// vivid solid in dark mode. The border adds the "this one's selected"
// weight a plain tint alone wouldn't have.
const STATUS_ACTIVE_CLASS: Record<Status, string> = {
  new: "border-foreground/25 bg-foreground/8 text-foreground",
  in_progress: "border-warning/50 bg-warning/15 text-warning",
  answered: "border-success/50 bg-success/15 text-success",
  escalated: "border-destructive/50 bg-destructive/15 text-destructive",
  closed: "border-foreground/25 bg-foreground/8 text-foreground",
};

const STATUS_BAR_CLASS: Record<Status, string> = {
  new: "bg-muted-foreground",
  in_progress: "bg-warning",
  answered: "bg-success",
  escalated: "bg-destructive",
  closed: "bg-muted-foreground",
};

// The same fills, used as a small standing dot on every inactive chip (not
// just the bar) — without this, every unselected chip reads as the same
// flat grey and the color coding only shows up once you click something.
const STATUS_DOT_CLASS = STATUS_BAR_CLASS;

// Only the "All" chip still uses a solid fill (primary is a mid-saturation
// amber that reads fine solid in both themes, unlike warning/success/
// destructive above) — its count badge still needs the color-mix contrast
// trick so the badge doesn't merge into that solid background.
const ALL_FG_VAR = "--primary-foreground";

function activeCountStyle(cssVar: string) {
  return { backgroundColor: `color-mix(in srgb, var(${cssVar}) 26%, transparent)` };
}

const POP_ANIMATION = "motion-safe:animate-[chip-pop_260ms_cubic-bezier(0.34,1.56,0.64,1)]";

interface StatusQuickFilterChipsProps {
  statusCounts: Record<Status, number>;
}

// ticket-management (Plan 29 — status quick-filter chips): sits directly
// above <TicketFilterBar /> inside StaffTicketQueue.tsx, additive only. A
// chip/segment click writes the same ?status= query param the filter bar's
// Status <Select> already reads, so clicking either one updates the other —
// no separate client state, matching Story 60's server-driven-filtering
// convention. TicketFilterBar.tsx itself is untouched.
export function StatusQuickFilterChips({ statusCounts }: StatusQuickFilterChipsProps) {
  const t = useTranslations("Tickets");
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") as Status | null;
  const total = STATUS_ORDER.reduce((sum, key) => sum + statusCounts[key], 0);

  function setStatus(next: Status | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("status", next);
    } else {
      params.delete("status");
    }
    // Same as any other filter change (TicketFilterBar's updateParam) —
    // switching status resets pagination to page 1.
    params.delete("page");
    router.push(`/tickets?${params.toString()}`);
  }

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card/50 p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-baseline justify-between border-b border-border/60 pb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("queueComposition")}
        </span>
        <span className="font-mono text-base font-semibold tabular-nums text-foreground">{total}</span>
      </div>

      <div className="mb-4 flex h-3 gap-[3px] overflow-hidden rounded-full bg-muted p-[3px] shadow-inner">
        {STATUS_ORDER.map((key) => {
          const pct = total ? (statusCounts[key] / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <button
              key={key}
              type="button"
              aria-label={t(STATUS_KEY[key])}
              title={`${t(STATUS_KEY[key])} — ${statusCounts[key]}`}
              onClick={() => setStatus(key)}
              className={cn(
                "h-full rounded-full transition-[filter,width] duration-300 hover:brightness-110",
                STATUS_BAR_CLASS[key]
              )}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => setStatus(null)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium shadow-xs transition-all duration-150 hover:-translate-y-px active:scale-95",
            status === null
              ? cn("border-transparent bg-primary text-primary-foreground shadow-md", POP_ANIMATION)
              : "border-border bg-card text-foreground hover:border-primary/50"
          )}
        >
          {t("filterAll")}
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums",
              status !== null && "bg-muted text-muted-foreground"
            )}
            style={status === null ? activeCountStyle(ALL_FG_VAR) : undefined}
          >
            {total}
          </span>
        </button>
        {STATUS_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium shadow-xs transition-all duration-150 hover:-translate-y-px active:scale-95",
              status === key
                ? cn(STATUS_ACTIVE_CLASS[key], "shadow-sm", POP_ANIMATION)
                : "border-border bg-card text-foreground hover:border-primary/50"
            )}
          >
            {status !== key && (
              <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT_CLASS[key])} aria-hidden="true" />
            )}
            {t(STATUS_KEY[key])}
            <span
              className={cn(
                "rounded-full bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground",
                status === key && "bg-background/60"
              )}
            >
              {statusCounts[key]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
