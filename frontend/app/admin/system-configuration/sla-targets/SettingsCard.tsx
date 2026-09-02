"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateSlaSystemSettings } from "./actions";

// sla-automation Story 25, Backend Task 7 / Frontend Task 10: the SLA
// monitor's own tuning (Story 27's at-risk threshold + scan interval),
// admin-editable here instead of an environment variable. Gated on
// sla:configure specifically — distinct from sla:targets_view/edit, which
// gate the target list this card sits above.
export function SettingsCard({
  initialAtRiskPercent,
  initialScanIntervalMinutes,
  canEdit,
}: {
  initialAtRiskPercent: number;
  initialScanIntervalMinutes: number;
  canEdit: boolean;
}) {
  const t = useTranslations("AdminSlaTargets");
  const [atRiskPercent, setAtRiskPercent] = useState(initialAtRiskPercent);
  const [scanIntervalMinutes, setScanIntervalMinutes] = useState(initialScanIntervalMinutes);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="mb-6 border-dashed">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center gap-2">
          <Timer className="size-4 text-icon-date" />
          <h3 className="text-sm font-semibold">{t("settings.title")}</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="at-risk-percent">{t("settings.atRiskPercentLabel")}</Label>
            <div className="flex h-8 items-stretch overflow-hidden rounded-xl border border-input bg-muted/40 transition-all duration-150 focus-within:border-ring focus-within:bg-card focus-within:ring-4 focus-within:ring-ring/15">
              <Input
                id="at-risk-percent"
                type="number"
                min={1}
                max={99}
                disabled={!canEdit || pending}
                value={atRiskPercent}
                onChange={(e) => setAtRiskPercent(Number(e.target.value))}
                className="h-auto flex-1 rounded-none border-0 bg-transparent focus-visible:ring-0"
              />
              <span className="flex shrink-0 items-center border-s border-input bg-muted px-2.5 text-xs font-medium text-muted-foreground">
                {t("settings.percentElapsed")}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="scan-interval">{t("settings.scanIntervalLabel")}</Label>
            <div className="flex h-8 items-stretch overflow-hidden rounded-xl border border-input bg-muted/40 transition-all duration-150 focus-within:border-ring focus-within:bg-card focus-within:ring-4 focus-within:ring-ring/15">
              <Input
                id="scan-interval"
                type="number"
                min={1}
                max={60}
                disabled={!canEdit || pending}
                value={scanIntervalMinutes}
                onChange={(e) => setScanIntervalMinutes(Number(e.target.value))}
                className="h-auto flex-1 rounded-none border-0 bg-transparent focus-visible:ring-0"
              />
              <span className="flex shrink-0 items-center border-s border-input bg-muted px-2.5 text-xs font-medium text-muted-foreground">
                {t("settings.minutes")}
              </span>
            </div>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {canEdit && (
          <div className="mt-4 flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => {
                setSaved(false);
                setError(null);
                startTransition(async () => {
                  const result = await updateSlaSystemSettings({ atRiskPercent, scanIntervalMinutes });
                  if (result.error) setError(result.error);
                  else setSaved(true);
                });
              }}
            >
              {pending ? t("settings.saving") : t("settings.saveButton")}
            </Button>
            {saved && <span className="text-sm text-success">{t("settings.saved")}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
