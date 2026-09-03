"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateSlaTarget } from "../../actions";

const ANY_VALUE = "__any__";
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

interface SlaTargetRow {
  id: string;
  priority: "low" | "medium" | "high" | "urgent" | null;
  category: string | null;
  responseMinutes: number;
  resolutionMinutes: number;
  isDefault: boolean;
}

export function EditSlaTargetForm({ target, categoryNames }: { target: SlaTargetRow; categoryNames: string[] }) {
  const t = useTranslations("AdminSlaTargets");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [priority, setPriority] = useState<string>(target.priority ?? ANY_VALUE);
  const [category, setCategory] = useState<string>(target.category ?? ANY_VALUE);
  const [responseMinutes, setResponseMinutes] = useState<number>(target.responseMinutes);
  const [resolutionMinutes, setResolutionMinutes] = useState<number>(target.resolutionMinutes);

  const clientError = resolutionMinutes < responseMinutes ? t("form.resolutionLessThanResponse") : null;

  return (
    <Card className="w-full max-w-md rounded-[28px] rounded-ss-none border-none shadow-pop ring-1 ring-foreground/10">
      <CardHeader className="items-center gap-1 pt-6 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">{t("editTitle")}</CardTitle>
        <CardDescription className="text-balance">
          {target.isDefault ? t("editDefaultSubheading") : t("newSubheading")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Default (wildcard) row: priority/category are permanently null —
            the backend rejects moving either off null, so don't offer the
            controls at all rather than let the user hit a 400. */}
        {!target.isDefault && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="priority">{t("columns.priority")}</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_VALUE}>{t("anyDefaultLabel")}</SelectItem>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`priority.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">{t("columns.category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_VALUE}>{t("anyDefaultLabel")}</SelectItem>
                  {categoryNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="responseMinutes">{t("form.responseMinutesLabel")}</Label>
            <Input
              id="responseMinutes"
              type="number"
              min={1}
              value={responseMinutes}
              onChange={(e) => setResponseMinutes(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resolutionMinutes">{t("form.resolutionMinutesLabel")}</Label>
            <Input
              id="resolutionMinutes"
              type="number"
              min={1}
              value={resolutionMinutes}
              onChange={(e) => setResolutionMinutes(Number(e.target.value))}
              aria-invalid={Boolean(clientError)}
            />
          </div>
        </div>
        {(clientError || error) && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{clientError ?? error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 border-t-0 bg-transparent pt-1">
        <Button
          type="button"
          disabled={pending || Boolean(clientError)}
          className="w-full transition-transform active:scale-[0.98]"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await updateSlaTarget(target.id, {
                priority: target.isDefault ? null : priority === ANY_VALUE ? null : priority,
                category: target.isDefault ? null : category === ANY_VALUE ? null : category,
                responseMinutes,
                resolutionMinutes,
              });
              if (result.error) setError(result.error);
              else router.push("/admin/system-configuration/sla-targets");
            });
          }}
        >
          {pending ? t("form.submitPending") : t("form.saveChanges")}
        </Button>
        <Link
          href="/admin/system-configuration/sla-targets"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("form.cancel")}
        </Link>
      </CardFooter>
    </Card>
  );
}
