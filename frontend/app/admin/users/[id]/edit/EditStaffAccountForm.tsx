"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, Mail, User } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// Same persistent identity-panel layout as NewStaffAccountForm — no
// password field here, since resetting one isn't in scope.
export function EditStaffAccountForm({ account }: { account: StaffAccount }) {
  const t = useTranslations("EditStaffAccount");
  const boundAction = updateStaffAccount.bind(null, account.id);
  const [state, formAction, pending] = useActionState(boundAction, INITIAL_STATE);

  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [role, setRole] = useState<"agent" | "subadmin">(account.role);
  const [permissions, setPermissions] = useState<string[]>(account.permissions);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0;
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
                <p className="font-semibold">{name.trim() || account.email}</p>
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
