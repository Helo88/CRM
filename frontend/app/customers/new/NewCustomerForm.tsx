"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, Mail, Phone, User } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createCustomer, type NewCustomerActionState } from "./actions";

const INITIAL_STATE: NewCustomerActionState = { error: null };

export function NewCustomerForm() {
  const t = useTranslations("NewCustomer");
  const tAuth = useTranslations("Auth");
  const [state, formAction, pending] = useActionState(createCustomer, INITIAL_STATE);
  // Controlled inputs — see LoginForm.tsx for why.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Card className="w-full max-w-md rounded-[28px] rounded-ss-none border-none shadow-2xl shadow-black/20 ring-1 ring-foreground/10">
      <CardHeader className="items-center gap-1 pt-6 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">{t("heading")}</CardTitle>
        <CardDescription className="text-balance">{t("subheading")}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-5">
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
            <Label htmlFor="phone">{t("phoneOptional")}</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="phone"
                name="phone"
                type="tel"
                className="ps-8"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={Boolean(state.fieldErrors?.phone)}
              />
            </div>
            {state.fieldErrors?.phone && <p className="text-sm text-destructive">{state.fieldErrors.phone}</p>}
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
          {state.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="border-t-0 bg-transparent pt-1">
          <Button type="submit" disabled={pending} className="w-full transition-transform active:scale-[0.98]">
            {pending ? t("submitPending") : t("submit")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
