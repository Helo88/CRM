"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CircleAlert, Mail, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { stripSubadminOnlyPermissions } from "@/lib/permissions";
import { PermissionsStep } from "../../PermissionsStep";
import { updateStaffAccount, type EditStaffAccountActionState } from "./actions";

const INITIAL_STATE: EditStaffAccountActionState = { error: null };

interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: "agent" | "subadmin";
  isActive: boolean;
  permissions: string[];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Same full-width header + tabs shell as customers/[id]/CustomerProfileForm —
// replaces the earlier narrow centered numbered-checkmark stepper. Both tab
// panels stay mounted (forceMount) so name/email/role and the permissions
// list submit together as one form regardless of which tab is active — the
// same "hidden but still mounted" approach the stepper used before. Radix's
// Presence sets `present = forceMount || isSelected`, so once forceMount is
// true its own `hidden={!present}` is permanently false for both panels —
// hiding the inactive one is on us via the `data-[state=inactive]:hidden`
// class on each TabsContent below, not something Radix does automatically.
// `canEditDetails` (staff:edit) and `canEditPermissions` (staff:permissions)
// let a viewer who only holds staff:view_account reach this page and see
// everything, with every field/switch disabled and no submit control — never
// a working form they can't actually use.
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
  const tNav = useTranslations("Nav");
  const boundAction = useMemo(
    () => updateStaffAccount.bind(null, account.id, canEditDetails, canEditPermissions),
    [account.id, canEditDetails, canEditPermissions]
  );
  const [state, formAction, pending] = useActionState(boundAction, INITIAL_STATE);

  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [role, setRole] = useState<"agent" | "subadmin">(account.role);
  const [permissions, setPermissions] = useState<string[]>(account.permissions);

  const canSubmit = canEditDetails || canEditPermissions;
  const tabTriggerClass =
    "px-1 pb-2.5 text-sm data-active:text-primary dark:data-active:text-primary after:bg-primary group-data-horizontal/tabs:after:bottom-0";

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-muted-foreground">
        <Link href="/admin/users" className="hover:text-foreground hover:underline">
          {tNav("accounts")}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-medium text-foreground">{account.name}</span>
      </nav>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:flex-row sm:items-center sm:p-6">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
          {initials(account.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{account.name}</h1>
            <Badge variant="outline" className="border-transparent bg-secondary">
              {role === "subadmin" ? t("roleSubadmin") : t("roleAgent")}
            </Badge>
            <Badge
              variant="outline"
              className={
                account.isActive
                  ? "border-transparent bg-success/10 text-success"
                  : "bg-secondary"
              }
            >
              {account.isActive ? t("statusActive") : t("statusInactive")}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{account.email}</p>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList variant="line" className="h-auto gap-4 border-b border-border p-0">
          <TabsTrigger value="details" className={tabTriggerClass}>
            {t("stepDetails")}
          </TabsTrigger>
          <TabsTrigger value="permissions" className={tabTriggerClass}>
            {t("stepPermissions")}
          </TabsTrigger>
        </TabsList>

        <form action={formAction}>
          <TabsContent value="details" forceMount className="pt-6 data-[state=inactive]:hidden">
            <div className="max-w-xl rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
              <div className="flex flex-col gap-5">
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
              </div>
            </div>
          </TabsContent>

          <TabsContent value="permissions" forceMount className="pt-6 data-[state=inactive]:hidden">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
              <PermissionsStep
                value={permissions}
                onChange={setPermissions}
                disabled={pending || !canEditPermissions}
                role={role}
              />
              <input type="hidden" name="permissions" value={JSON.stringify(permissions)} />
            </div>
          </TabsContent>

          {state.error && (
            <Alert variant="destructive" className="mt-4">
              <CircleAlert />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {canSubmit && (
            <div className="pt-4">
              <Button type="submit" disabled={pending} className="transition-transform active:scale-[0.98]">
                {pending ? t("submitPending") : t("submit")}
              </Button>
            </div>
          )}
        </form>
      </Tabs>
    </div>
  );
}
