"use client";

import { Ban, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConfirmActionButton } from "./ConfirmActionButton";
import { RenameCategoryDialog } from "./RenameCategoryDialog";
import { deactivateTicketCategory, reactivateTicketCategory } from "./actions";

export function RowActions({
  categoryId,
  name,
  active,
}: {
  categoryId: string;
  name: string;
  active: boolean;
}) {
  const t = useTranslations("AdminTicketCategories");

  return (
    <div className="flex items-center justify-end gap-1.5">
      <RenameCategoryDialog categoryId={categoryId} currentName={name} />
      {active ? (
        <ConfirmActionButton
          icon={<Ban className="size-4" />}
          label={t("actionDeactivate")}
          destructive
          confirmTitle={t("confirmDeactivateTitle")}
          confirmBody={t("confirmDeactivateBody")}
          confirmActionLabel={t("confirmDeactivateAction")}
          cancelLabel={t("confirmDeactivateCancel")}
          onConfirm={() => deactivateTicketCategory(categoryId)}
        />
      ) : (
        <ConfirmActionButton
          icon={<CheckCircle2 className="size-4" />}
          label={t("actionReactivate")}
          successful
          confirmTitle={t("confirmReactivateTitle")}
          confirmBody={t("confirmReactivateBody")}
          confirmActionLabel={t("confirmReactivateAction")}
          cancelLabel={t("confirmReactivateCancel")}
          onConfirm={() => reactivateTicketCategory(categoryId)}
        />
      )}
    </div>
  );
}
