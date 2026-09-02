"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { summarizeTicketAction } from "./summarizeAction";

type SummarizeErrorReason = "not_enough_messages" | "ai_unavailable" | "forbidden";

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
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<SummarizeErrorReason | undefined>();
  const [pending, startTransition] = useTransition();

  const tooFewMessages = messageCount < 2;
  const disabled = !canSummarize || tooFewMessages;
  const disabledTitle = !canSummarize
    ? t("summary.noPermission")
    : tooFewMessages
      ? t("summary.notEnoughMessages")
      : undefined;

  function handleSummarize() {
    setError(undefined);
    startTransition(async () => {
      const result = await summarizeTicketAction(ticketId);
      if (result.ok) {
        setSummary(result.summary);
      } else {
        setSummary(null);
        setError(result.reason);
      }
    });
  }

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
      {(summary || error) && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("summary.panelTitle")}
          </p>
          {error === "not_enough_messages" && <p className="text-muted-foreground">{t("summary.notEnoughMessages")}</p>}
          {error === "forbidden" && <p className="text-muted-foreground">{t("summary.noPermission")}</p>}
          {error === "ai_unavailable" && (
            <div className="flex flex-col items-start gap-2">
              <p className="text-muted-foreground">{t("summary.aiUnavailable")}</p>
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={handleSummarize}>
                {t("summary.retry")}
              </Button>
            </div>
          )}
          {summary && <pre className="whitespace-pre-wrap font-sans text-sm">{summary}</pre>}
        </div>
      )}
    </div>
  );
}
