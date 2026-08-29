"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PERMISSION_CATEGORIES, SUBADMIN_ONLY_PERMISSIONS } from "@/lib/permissions";
import { useTranslations } from "next-intl";

// Shared by the create (NewStaffAccountForm) and edit (EditStaffAccountForm)
// steppers — permissions are granted per individual account (security-admin
// Story 46), so this is always scoped to ONE account's permission list, not
// a role-wide table. A 2-column grid (instead of one full-width table row
// per key) roughly halves the scroll height now that the stepper card is
// wide enough to fit it.
//
// `role` filters which keys are even offered: staff/system-administration
// keys (SUBADMIN_ONLY_PERMISSIONS) only ever apply to a sub-admin account —
// an agent's form never shows them at all, matching the backend's rejection
// of those keys on an agent target. A category with nothing left to show
// for the current role is omitted entirely.
export function PermissionsStep({
  value,
  onChange,
  disabled,
  role,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  role: "agent" | "subadmin";
}) {
  const t = useTranslations("Permissions");

  function toggle(key: string, checked: boolean) {
    onChange(checked ? Array.from(new Set([...value, key])) : value.filter((k) => k !== key));
  }

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(PERMISSION_CATEGORIES).map(([category, allKeys]) => {
        const keys = role === "subadmin" ? allKeys : allKeys.filter((key) => !SUBADMIN_ONLY_PERMISSIONS.has(key));
        if (keys.length === 0) return null;
        return (
          <div key={category}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`categories.${category}`)}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {keys.map((key) => (
                <Label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5 font-normal"
                >
                  <span className="text-sm">{t(`keys.${key}`)}</span>
                  <Switch
                    checked={value.includes(key)}
                    disabled={disabled}
                    onCheckedChange={(checked) => toggle(key, checked)}
                  />
                </Label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
