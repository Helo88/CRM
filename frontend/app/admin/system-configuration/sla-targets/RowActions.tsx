"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { deleteSlaTarget } from "./actions";

export function RowActions({ targetId, isDefault }: { targetId: string; isDefault: boolean }) {
  const t = useTranslations("AdminSlaTargets");

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        variant="ghost"
        size="icon-sm"
        title={t("actionEdit")}
        aria-label={t("actionEdit")}
        className="text-icon-status hover:bg-icon-status/10 hover:text-icon-status"
        asChild
      >
        <Link href={`/admin/system-configuration/sla-targets/${targetId}/edit`}>
          <Pencil className="size-4" />
        </Link>
      </Button>
      {isDefault ? (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled
          title={t("cannotDeleteDefault")}
          aria-label={t("cannotDeleteDefault")}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : (
        <ConfirmActionButton
          icon={<Trash2 className="size-4" />}
          label={t("actionDelete")}
          destructive
          confirmTitle={t("deleteConfirmTitle")}
          confirmBody={t("deleteConfirmBody")}
          confirmActionLabel={t("actionDelete")}
          cancelLabel={t("deleteCancel")}
          onConfirm={() => deleteSlaTarget(targetId)}
        />
      )}
    </div>
  );
}
