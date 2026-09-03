"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { summarizeResource, type SummarizeResult } from "@/lib/summarize";

export type SummarizeErrorReason = Exclude<SummarizeResult, { ok: true }>["reason"];

// ai-features Story 32: shared "AI summary" state for both a ticket thread
// (frontend/app/tickets/[id]/TicketSummaryPanel.tsx) and a live-chat
// conversation (frontend/app/chats/[id]/AgentChatPanel.tsx) — previously two
// independently-drifting copies of the same state/gating logic (see the
// code review of commit 3c96c60, which is what flagged the two surfaces
// disagreeing on what counts as "enough messages"). Only the STATE is
// shared here, not a single drop-in button+panel component: the two
// surfaces place the trigger button in different spots in their own layout
// (a dedicated row vs. inline in a CardHeader next to "Mark resolved"), so
// forcing one layout on both would fight the actual UI rather than
// deduplicate it. Pair with <SummaryResultPanel> below for the part that
// genuinely is identical markup in both places.
export function useSummarize(kind: "tickets" | "conversations", id: string, canSummarize: boolean, messageCount: number) {
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<SummarizeErrorReason | undefined>();
  const [pending, startTransition] = useTransition();

  const tooFewMessages = messageCount < 2;
  const disabled = !canSummarize || tooFewMessages;

  function handleSummarize() {
    setError(undefined);
    startTransition(async () => {
      const result = await summarizeResource(kind, id);
      if (result.ok) {
        setSummary(result.summary);
      } else {
        setSummary(null);
        setError(result.reason);
      }
    });
  }

  return { summary, error, pending, disabled, tooFewMessages, handleSummarize };
}

// The result box IS identical markup on both surfaces — same four error
// branches, same <pre> summary. `namespace` picks which i18n section's
// `summary.*` keys to read; TicketDetail and AgentChats are kept as
// matching key shapes by convention (verified in en.json/ar.json) so this
// works unmodified for either.
export function SummaryResultPanel({
  namespace,
  summary,
  error,
  pending,
  onRetry,
}: {
  namespace: "TicketDetail" | "AgentChats";
  summary: string | null;
  error: SummarizeErrorReason | undefined;
  pending: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations(namespace);
  if (!summary && !error) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("summary.panelTitle")}
      </p>
      {error === "not_enough_messages" && <p className="text-muted-foreground">{t("summary.notEnoughMessages")}</p>}
      {error === "not_found" && <p className="text-muted-foreground">{t("summary.notFound")}</p>}
      {error === "forbidden" && <p className="text-muted-foreground">{t("summary.noPermission")}</p>}
      {error === "ai_unavailable" && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-muted-foreground">{t("summary.aiUnavailable")}</p>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onRetry}>
            {t("summary.retry")}
          </Button>
        </div>
      )}
      {summary && <pre className="whitespace-pre-wrap font-sans text-sm">{summary}</pre>}
    </div>
  );
}
