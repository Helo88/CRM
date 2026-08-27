"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, Mail, User } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionsStep } from "../PermissionsStep";
import { createStaffAccount, type NewStaffAccountActionState } from "./actions";

const INITIAL_STATE: NewStaffAccountActionState = { error: null };

// Persistent identity panel + permissions, side by side — no step-to-step
// transition. Permissions are granted per individual account (security-admin
// Story 46), so keeping the person's identity visible the whole time while
// their permissions are set reinforces that directly, instead of hiding it
// behind a "step 2 of 2".
export function NewStaffAccountForm() {
  const t = useTranslations("NewStaffAccount");
  const tAuth = useTranslations("Auth");
  const [state, formAction, pending] = useActionState(createStaffAccount, INITIAL_STATE);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"agent" | "subadmin">("agent");
  const [permissions, setPermissions] = useState<string[]>([]);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length >= 8;
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const roleLabel = role === "agent" ? t("roleAgent") : t("roleSubadmin");

  return (
    <Card className="w-full max-w-4xl rounded-[28px] border-none shadow-pop ring-1 ring-foreground/10">
      <CardHeader className="pt-6">
        <CardTitle className="text-2xl font-bold tracking-tight">{t("heading")}</CardTitle>
        <CardDescription className="text-balance">{t("subheading")}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="grid gap-6 md:grid-cols-[260px_1fr]">
          {/* Identity panel */}
          <div className="flex flex-col gap-5 md:border-e md:border-border md:pe-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <Avatar className="size-16">
                <AvatarFallback className="bg-accent text-xl text-accent-foreground">{initial}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{name.trim() || t("newAccountPlaceholder")}</p>
                <p className="text-xs text-muted-foreground">{roleLabel}</p>
              </div>
            </div>

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
              {state.fieldErrors?.password && <p className="text-sm text-destructive">{state.fieldErrors.password}</p>}
            </div>
          </div>

          {/* Permissions panel */}
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold">{t("permissionsHeading")}</h2>
              <p className="text-xs text-muted-foreground">{t("permissionsSubheading")}</p>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              <PermissionsStep value={permissions} onChange={setPermissions} disabled={pending} />
            </div>
            <input type="hidden" name="permissions" value={JSON.stringify(permissions)} />
          </div>
        </CardContent>

        {state.error && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          </CardContent>
        )}

        <CardFooter className="justify-end border-t-0 bg-transparent pt-1">
          <Button
            type="submit"
            disabled={!canSubmit || pending}
            className="transition-transform active:scale-[0.98]"
          >
            {pending ? t("submitPending") : t("submit")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
