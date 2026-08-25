"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { register, type AuthActionState } from "./actions";

const INITIAL_STATE: AuthActionState = { error: null };

export function RegisterForm() {
  const t = useTranslations("Register");
  const [state, formAction, pending] = useActionState(register, INITIAL_STATE);
  // Controlled inputs — see LoginForm.tsx for why (React resets uncontrolled
  // fields to empty after every Server Action submission).
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("heading")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("name")}</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.name)}
              required
            />
            {state.fieldErrors?.name && <p className="text-sm text-destructive">{state.fieldErrors.name}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.email)}
              required
            />
            {state.fieldErrors?.email && <p className="text-sm text-destructive">{state.fieldErrors.email}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.password)}
              required
            />
            {state.fieldErrors?.password && <p className="text-sm text-destructive">{state.fieldErrors.password}</p>}
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? t("submitPending") : t("submit")}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            {t("haveAccount")}{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              {t("logIn")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
