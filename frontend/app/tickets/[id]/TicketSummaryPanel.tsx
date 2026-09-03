"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSummarize, SummaryResultPanel } from "@/components/SummaryPanel";

// ai-features Story 32: one-click, never-persisted AI summary of this
// ticket's thread. The plan's i18n task listed issueLabel/triedLabel/
// statusLabel for the three summary sections, but its own frontend task
// says to render the returned text as-is (`<pre>`), never parsed — Gemini's
// prompt (summary.service.ts) already asks for those three labels inline in
// the plain-text response, so a second, separately-templated set of labels
// here would either go unused or force the parsing the plan says not to do.
// Deviates from the plan by dropping those three unused keys; every key
// actually rendered below is added to both message catalogs.
export function TicketSummaryPanel({
  ticketId,
  canSummarize,
  messageCount,
}: {
  ticketId: string;
  canSummarize: boolean;
  messageCount: number;
}) {
  const t = useTranslations("TicketDetail");
  const { summary, error, pending, disabled, tooFewMessages, handleSummarize } = useSummarize(
    "tickets",
    ticketId,
    canSummarize,
    messageCount
  );
  const disabledTitle = !canSummarize
    ? t("summary.noPermission")
    : tooFewMessages
      ? t("summary.notEnoughMessages")
      : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("thread")}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || pending}
          title={disabledTitle}
          onClick={handleSummarize}
        >
          <Sparkles className="size-4" />
          {pending ? t("summary.loading") : summary ? t("summary.regenerate") : t("summary.button")}
        </Button>
      </div>
      <SummaryResultPanel namespace="TicketDetail" summary={summary} error={error} pending={pending} onRetry={handleSummarize} />
    </div>
  );
}
