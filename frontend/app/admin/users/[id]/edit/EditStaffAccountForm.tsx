"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, Mail, User, ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepIndicator } from "@/components/StepIndicator";
import { stripSubadminOnlyPermissions } from "@/lib/permissions";
import { PermissionsStep } from "../../PermissionsStep";
import { updateStaffAccount, type EditStaffAccountActionState } from "./actions";

const INITIAL_STATE: EditStaffAccountActionState = { error: null };

interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: "agent" | "subadmin";
  permissions: string[];
}

// Same two-step numbered-checkmark stepper as NewStaffAccountForm — no
// password field here, since resetting one isn't in scope. `canEditDetails`
// (staff:edit) and `canEditPermissions` (staff:permissions) let a viewer who
// only holds staff:view_account reach this page and see everything, with
// every field/switch disabled and no submit control — never a working form
// they can't actually use.
export function EditStaffAccountForm({
  account,
  canEditDetails,
  canEditPermissions,
}: {
  account: StaffAccount;
  canEditDetails: boolean;
  canEditPermissions: boolean;
}) {
  const t = useTranslations("EditStaffAccount");
  const boundAction = useMemo(
    () => updateStaffAccount.bind(null, account.id, canEditDetails, canEditPermissions),
    [account.id, canEditDetails, canEditPermissions]
  );
  const [state, formAction, pending] = useActionState(boundAction, INITIAL_STATE);
  const [step, setStep] = useState<0 | 1>(0);

  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [role, setRole] = useState<"agent" | "subadmin">(account.role);
  const [permissions, setPermissions] = useState<string[]>(account.permissions);

  const canSubmit = canEditDetails || canEditPermissions;
  const step1Valid = name.trim().length > 0 && email.trim().length > 0;
  const steps = [{ key: "details", label: t("stepDetails") }, { key: "permissions", label: t("stepPermissions") }];

  return (
    <Card className="w-full max-w-2xl rounded-[28px] border-none shadow-pop ring-1 ring-foreground/10">
      <CardHeader className="pt-6">
        <CardTitle className="text-2xl font-bold tracking-tight">{t("heading")}</CardTitle>
        <CardDescription className="text-balance">
          {t(step === 0 ? "subheading" : "subheadingPermissions")}
        </CardDescription>
        <div className="pt-4">
          <StepIndicator steps={steps} currentIndex={step} />
        </div>
      </CardHeader>
      <form action={formAction}>
        <CardContent className={step === 0 ? "flex flex-col gap-5" : "hidden"}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("name")}</Label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name"
                name="name"
                className="ps-8"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(state.fieldErrors?.name)}
                disabled={!canEditDetails}
                required
              />
            </div>
            {state.fieldErrors?.name && <p className="text-sm text-destructive">{state.fieldErrors.name}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                className="ps-8"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(state.fieldErrors?.email)}
                disabled={!canEditDetails}
                required
              />
            </div>
            {state.fieldErrors?.email && <p className="text-sm text-destructive">{state.fieldErrors.email}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="role">{t("role")}</Label>
            <Select
              name="role"
              value={role}
              disabled={!canEditDetails}
              onValueChange={(v) => {
                const nextRole = v as "agent" | "subadmin";
                setRole(nextRole);
                if (nextRole === "agent") setPermissions((prev) => stripSubadminOnlyPermissions(prev));
              }}
            >
              <SelectTrigger id="role" className="w-full" aria-invalid={Boolean(state.fieldErrors?.role)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">{t("roleAgent")}</SelectItem>
                <SelectItem value="subadmin">{t("roleSubadmin")}</SelectItem>
              </SelectContent>
            </Select>
            {state.fieldErrors?.role && <p className="text-sm text-destructive">{state.fieldErrors.role}</p>}
          </div>
        </CardContent>

        <CardContent className={step === 1 ? "flex flex-col gap-3" : "hidden"}>
          <PermissionsStep
            value={permissions}
            onChange={setPermissions}
            disabled={pending || !canEditPermissions}
            role={role}
          />
          <input type="hidden" name="permissions" value={JSON.stringify(permissions)} />
        </CardContent>

        {state.error && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          </CardContent>
        )}

        {/* key={step} forces React to unmount/remount this footer instead of
            reusing the "Next" button's DOM node for "Save changes" — reusing
            it let a browser's submit-activation check see the just-swapped
            type="submit" attribute on the very click that was meant to only
            advance the step, silently submitting the form. */}
        <CardFooter className="flex gap-2 border-t-0 bg-transparent pt-1" key={step}>
          {step === 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(0)}
              disabled={pending}
              className={canSubmit ? undefined : "flex-1"}
            >
              <ArrowLeft className="size-4 rtl:-scale-x-100" />
              {t("back")}
            </Button>
          )}
          {step === 0 ? (
            <Button
              type="button"
              className="flex-1 transition-transform active:scale-[0.98]"
              disabled={!step1Valid}
              onClick={() => setStep(1)}
            >
              {t("next")}
              <ArrowRight className="size-4 rtl:-scale-x-100" />
            </Button>
          ) : (
            canSubmit && (
              <Button type="submit" disabled={pending} className="flex-1 transition-transform active:scale-[0.98]">
                {pending ? t("submitPending") : t("submit")}
              </Button>
            )
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
