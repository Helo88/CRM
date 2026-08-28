"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CircleAlert, Mail, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { register, type AuthActionState } from "./actions";

const INITIAL_STATE: AuthActionState = { error: null };

export function RegisterForm() {
  const t = useTranslations("Register");
  const tAuth = useTranslations("Auth");
  const [state, formAction, pending] = useActionState(register, INITIAL_STATE);
  // Controlled inputs — see LoginForm.tsx for why (React resets uncontrolled
  // fields to empty after every Server Action submission).
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("subheading")}</p>
      </div>
      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t("name")}</Label>
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              name="name"
              autoComplete="name"
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
            autoComplete="new-password"
            minLength={8}
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
        <Button type="submit" disabled={pending} className="transition-transform active:scale-[0.98]">
          {pending ? t("submitPending") : t("submit")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            {t("logIn")}
          </Link>
        </p>
      </form>
    </div>
  );
}
