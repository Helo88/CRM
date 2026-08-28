"use client";

import Link from "next/link";
import { Ban, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "./ConfirmActionButton";
import { activateStaffAccount, deactivateStaffAccount, deleteStaffAccount } from "./actions";

export function RowActions({
  userId,
  role,
  isActive,
  canEdit,
  canToggleStatus,
  canDelete,
}: {
  userId: string;
  role: "agent" | "admin" | "subadmin";
  isActive: boolean;
  canEdit: boolean;
  canToggleStatus: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("AdminUsersList");

  return (
    <div className="flex items-center justify-end gap-1.5">
      {canEdit && role !== "admin" && (
        <Button variant="ghost" size="icon-sm" title={t("edit")} aria-label={t("edit")} asChild>
          <Link href={`/admin/users/${userId}/edit`}>
            <Pencil className="size-4" />
          </Link>
        </Button>
      )}
      {canToggleStatus &&
        (isActive ? (
          <ConfirmActionButton
            icon={<Ban className="size-4" />}
            label={t("deactivate")}
            destructive
            confirmTitle={t("deactivateConfirmTitle")}
            confirmBody={t("deactivateConfirmBody")}
            confirmActionLabel={t("deactivateConfirmAction")}
            cancelLabel={t("deactivateCancel")}
            onConfirm={() => deactivateStaffAccount(userId)}
          />
        ) : (
          <ConfirmActionButton
            icon={<CheckCircle2 className="size-4" />}
            label={t("activate")}
            successful
            confirmTitle={t("activateConfirmTitle")}
            confirmBody={t("activateConfirmBody")}
            confirmActionLabel={t("activateConfirmAction")}
            cancelLabel={t("activateCancel")}
            onConfirm={() => activateStaffAccount(userId)}
          />
        ))}
      {canDelete && (
        <ConfirmActionButton
          icon={<Trash2 className="size-4" />}
          label={t("delete")}
          destructive
          confirmTitle={t("deleteConfirmTitle")}
          confirmBody={t("deleteConfirmBody")}
          confirmActionLabel={t("deleteConfirmAction")}
          cancelLabel={t("deleteCancel")}
          onConfirm={() => deleteStaffAccount(userId)}
        />
      )}
    </div>
  );
}
