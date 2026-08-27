"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PERMISSION_CATEGORIES } from "@/lib/permissions";

// Shared by the create (NewStaffAccountForm) and edit (EditStaffAccountForm)
// steppers — permissions are granted per individual account (security-admin
// Story 46), so this is always scoped to ONE account's permission list, not
// a role-wide table.
export function PermissionsStep({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("Permissions");

  function toggle(key: string, checked: boolean) {
    onChange(checked ? Array.from(new Set([...value, key])) : value.filter((k) => k !== key));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <tbody>
          {Object.entries(PERMISSION_CATEGORIES).map(([category, keys]) => (
            <Fragment key={category}>
              <tr className="border-b border-border bg-muted/20">
                <td colSpan={2} className="p-2 ps-3 text-xs font-semibold uppercase text-muted-foreground">
                  {t(`categories.${category}`)}
                </td>
              </tr>
              {keys.map((key) => (
                <tr key={key} className="border-b border-border last:border-b-0">
                  <td className="p-3">{t(`keys.${key}`)}</td>
                  <td className="p-3 text-end">
                    <Label className="inline-flex items-center gap-2">
                      <Switch
                        checked={value.includes(key)}
                        disabled={disabled}
                        onCheckedChange={(checked) => toggle(key, checked)}
                      />
                    </Label>
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
