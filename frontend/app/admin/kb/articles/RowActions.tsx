"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { ArticleDialog } from "./ArticleDialog";
import { deleteArticleAction, type ArticleListItem } from "./actions";

export function RowActions({
  article,
  canEdit,
  canDelete,
}: {
  article: ArticleListItem;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("AdminArticles");

  return (
    <div className="flex items-center justify-end gap-1.5">
      {canEdit && (
        <ArticleDialog
          mode="edit"
          article={article}
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-icon-status hover:bg-icon-status/10 hover:text-icon-status"
              title={t("edit")}
              aria-label={t("edit")}
            >
              <Pencil className="size-4" />
            </Button>
          }
        />
      )}
      {canDelete && (
        <ConfirmActionButton
          icon={<Trash2 className="size-4" />}
          label={t("delete")}
          destructive
          confirmTitle={t("deleteConfirmTitle")}
          confirmBody={t("deleteConfirmBody")}
          confirmActionLabel={t("deleteConfirmAction")}
          cancelLabel={t("deleteConfirmCancel")}
          onConfirm={() => deleteArticleAction(article.id)}
        />
      )}
    </div>
  );
}
