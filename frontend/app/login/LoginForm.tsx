"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CircleAlert, Mail } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PresenceBadge } from "@/components/PresenceBadge";
import { login, type AuthActionState } from "./actions";

const INITIAL_STATE: AuthActionState = { error: null };

export function LoginForm() {
  const t = useTranslations("Login");
  const tAuth = useTranslations("Auth");
  const presenceLabel = tAuth("supportOnline");
  const [state, formAction, pending] = useActionState(login, INITIAL_STATE);
  // Controlled inputs: React resets uncontrolled <input>s to empty after every
  // Server Action submission (success or error) — without this, a failed
  // attempt silently blanks the email field, so a retry with just the
  // password fixed ends up submitting an empty email (see CLAUDE.md, "Forms
  // backed by Server Actions").
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <div className="animate-in fade-in slide-in-from-top-2 duration-500">
        <PresenceBadge label={presenceLabel} />
      </div>
      <Card className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:150ms] [animation-fill-mode:both] rounded-[28px] rounded-ss-none border-none shadow-2xl shadow-black/20 ring-1 ring-foreground/10 transition-shadow hover:shadow-primary/10">
      <CardHeader className="items-center gap-1 pt-6 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">{t("heading")}</CardTitle>
        <CardDescription className="text-balance">{t("subheading")}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
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
            <Label htmlFor="password">{t("password")}</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.password)}
              showLabel={tAuth("showPassword")}
              hideLabel={tAuth("hidePassword")}
              required
            />
            {state.fieldErrors?.password && <p className="text-sm text-destructive">{state.fieldErrors.password}</p>}
          </div>
          {state.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 border-t-0 bg-transparent pt-1">
          <Button type="submit" disabled={pending} className="transition-transform active:scale-[0.98]">
            {pending ? t("submitPending") : t("submit")}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            {t("noAccount")}{" "}
            <Link href="/register" className="text-primary underline-offset-4 hover:underline">
              {t("signUp")}
            </Link>
          </p>
        </CardFooter>
      </form>
      </Card>
    </div>
  );
}
