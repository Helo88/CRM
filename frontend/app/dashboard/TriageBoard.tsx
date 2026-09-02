"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { fetchWorkspace, type WorkspaceColumns } from "@/app/actions/workspace";
import { TriageCard } from "./TriageCard";

// Same cadence as NotificationBell — no need for finer granularity than
// sla.service.ts's AT_RISK_THRESHOLD_MS (15 minutes), and the same
// visibility guards keep a backgrounded tab from polling at all.
const POLL_INTERVAL_MS = 60_000;

// The three columns are a fixed literal, never Object.keys(columns): a column
// with nothing in it still renders its header, its (0) count and an empty
// line, so the board's shape never changes with the data.
const COLUMN_ORDER = ["breached", "at_risk", "on_track"] as const;
type ColumnKey = (typeof COLUMN_ORDER)[number];

// The only colors this board introduces — the semantic SLA tokens already
// defined in both themes in globals.css. No hex values, no new tokens.
const COLUMN_ACCENT: Record<ColumnKey, { dot: string; text: string; ring: string }> = {
  breached: { dot: "bg-destructive", text: "text-destructive", ring: "border-destructive/30" },
  at_risk: { dot: "bg-warning", text: "text-warning", ring: "border-warning/30" },
  on_track: { dot: "bg-success", text: "text-success", ring: "border-success/30" },
};

const COLUMN_LABEL_KEY: Record<ColumnKey, string> = {
  breached: "triage.columnBreached",
  at_risk: "triage.columnAtRisk",
  on_track: "triage.columnOnTrack",
};

// agent-workspace Story 35. A Client Component, not a Server one: the board
// refreshes itself on an interval, which needs client state and a timer.
// `initialColumns` is the page's server-rendered snapshot, so the first paint
// has no loading flash and no mount-time fetch (unlike NotificationBell,
// which starts with nothing).
export function TriageBoard({ initialColumns }: { initialColumns: WorkspaceColumns }) {
  const t = useTranslations("Dashboard");
  const [columns, setColumns] = useState(initialColumns);

  useEffect(() => {
    const poll = async () => {
      const result = await fetchWorkspace();
      // A failed poll (null) keeps the last-good columns rather than blanking
      // the board — no error state, no retry storm.
      if (result) setColumns(result.columns);
    };
    const interval = setInterval(() => {
      if (!document.hidden) poll();
    }, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const isEmpty = COLUMN_ORDER.every((key) => columns[key].total === 0);

  return (
    <section className="mb-9">
      <h2 className="text-lg font-bold tracking-tight">{t("triage.heading")}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{t("triage.subheading")}</p>

      {isEmpty ? <p className="mt-3 text-sm text-muted-foreground">{t("triage.emptyBoard")}</p> : null}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {COLUMN_ORDER.map((key) => {
          const accent = COLUMN_ACCENT[key];
          const column = columns[key];
          const hidden = column.total - column.items.length;

          return (
            <div key={key} className={cn("rounded-2xl border border-s-2 p-3", accent.ring)}>
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={cn("size-2 shrink-0 rounded-full", accent.dot)} aria-hidden />
                <h3 className={cn("text-sm font-bold", accent.text)}>{t(COLUMN_LABEL_KEY[key])}</h3>
                <span className="text-xs text-muted-foreground">({column.total})</span>
              </div>

              {column.items.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">{t("triage.emptyColumn")}</p>
              ) : (
                <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
                  {column.items.map((item) => (
                    <TriageCard key={`${item.type}-${item.id}`} item={item} accentText={accent.text} />
                  ))}
                </div>
              )}

              {hidden > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs">
                  <span className="text-muted-foreground">{t("triage.moreItems", { count: hidden })}</span>
                  {/* The overflow is a mix of both kinds, so both list views
                      are offered rather than guessing which one it holds. */}
                  <Link href="/tickets" className="underline underline-offset-2 hover:text-foreground">
                    {t("triage.viewAllTickets")}
                  </Link>
                  <Link href="/chats" className="underline underline-offset-2 hover:text-foreground">
                    {t("triage.viewAllChats")}
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
