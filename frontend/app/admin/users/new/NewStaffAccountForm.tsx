"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, Mail, User, ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepIndicator } from "@/components/StepIndicator";
import { PermissionsStep } from "../PermissionsStep";
import { createStaffAccount, type NewStaffAccountActionState } from "./actions";

const INITIAL_STATE: NewStaffAccountActionState = { error: null };

// Two-step, numbered-checkmark stepper (horizontal on desktop, vertical on
// mobile — see StepIndicator) instead of a persistent side-by-side panel.
// Step 1 collects the account's basic data, step 2 grants its individual
// permissions (security-admin Story 46 — permissions are per account).
export function NewStaffAccountForm() {
  const t = useTranslations("NewStaffAccount");
  const tAuth = useTranslations("Auth");
  const [state, formAction, pending] = useActionState(createStaffAccount, INITIAL_STATE);
  const [step, setStep] = useState<0 | 1>(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"agent" | "subadmin">("agent");
  const [permissions, setPermissions] = useState<string[]>([]);

  const step1Valid = name.trim().length > 0 && email.trim().length > 0 && password.length >= 8;
  const steps = [{ key: "details", label: t("stepDetails") }, { key: "permissions", label: t("stepPermissions") }];

  return (
    <Card className="w-full max-w-lg rounded-[28px] border-none shadow-pop ring-1 ring-foreground/10">
      <CardHeader className="pt-6">
        <CardTitle className="text-2xl font-bold tracking-tight">{t("heading")}</CardTitle>
        <CardDescription className="text-balance">{t("subheading")}</CardDescription>
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
                required
              />
            </div>
            {state.fieldErrors?.email && <p className="text-sm text-destructive">{state.fieldErrors.email}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="role">{t("role")}</Label>
            <Select name="role" value={role} onValueChange={(v) => setRole(v as "agent" | "subadmin")}>
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("initialPassword")}</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.password)}
              showLabel={tAuth("showPassword")}
              hideLabel={tAuth("hidePassword")}
              required
            />
            <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
            {state.fieldErrors?.password && <p className="text-sm text-destructive">{state.fieldErrors.password}</p>}
          </div>
        </CardContent>

        <CardContent className={step === 1 ? "flex flex-col gap-3" : "hidden"}>
          <p className="text-xs text-muted-foreground">{t("permissionsSubheading")}</p>
          <PermissionsStep value={permissions} onChange={setPermissions} disabled={pending} />
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

        <CardFooter className="flex gap-2 border-t-0 bg-transparent pt-1">
          {step === 1 && (
            <Button type="button" variant="outline" onClick={() => setStep(0)} disabled={pending}>
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
            <Button type="submit" disabled={pending} className="flex-1 transition-transform active:scale-[0.98]">
              {pending ? t("submitPending") : t("submit")}
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
