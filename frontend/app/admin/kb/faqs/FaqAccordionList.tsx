"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { pickLocalized } from "@/lib/localized";
import { localeDir, type Locale } from "@/lib/locale";
import { FaqDialog } from "./FaqDialog";
import { deleteFaqAction, type FaqRecord } from "./actions";

// Expandable rows: category badge + question lead the row, with a trailing
// icon rail (delete / edit / expand) — so actions sit at the row's natural
// end (right in LTR, left in RTL) instead of a fixed physical side. Not
// shadcn's <Accordion>: that widget's chevron can't be grouped with the
// other row actions, so this is a small hand-rolled multi-open expand/
// collapse instead of fighting the primitive's built-in trigger markup.
export function FaqAccordionList({
  faqs,
  canEdit,
  canDelete,
  locale,
}: {
  faqs: FaqRecord[];
  canEdit: boolean;
  canDelete: boolean;
  locale: Locale;
}) {
  const t = useTranslations("AdminFaqs");
  const tCat = useTranslations("KbCategories");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  // Both question lines share one physical edge — the admin locale's edge —
  // regardless of which language each line happens to be in. Aligning each
  // line to its OWN script direction (rtl:right / ltr:left) is what caused
  // the two lines to visually split apart instead of stacking.
  const questionAlign = localeDir(locale) === "rtl" ? "text-right" : "text-left";

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {faqs.map((faq) => {
        const isOpen = openIds.has(faq.id);
        const primary = pickLocalized(faq.question, locale);
        const secondaryLang: Locale = primary.language === "en" ? "ar" : "en";
        const secondary = faq.question[secondaryLang]?.trim();
        return (
          <div key={faq.id} className="rounded-xl border border-border bg-card">
            <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={() => toggle(faq.id)}
                className="min-w-0 sm:flex-1"
              >
                <div
                  className={cn("truncate text-base font-semibold text-foreground", questionAlign)}
                  dir={localeDir(primary.language)}
                  lang={primary.language}
                >
                  {primary.value}
                </div>
                {secondary && (
                  <div
                    className={cn("truncate text-sm text-muted-foreground", questionAlign)}
                    dir={localeDir(secondaryLang)}
                    lang={secondaryLang}
                  >
                    {secondary}
                  </div>
                )}
              </button>

              {/* Badge + actions regroup into their own row on mobile
                  (sm:contents dissolves this wrapper back into the flex row
                  above at sm+, restoring the single-row desktop layout). */}
              <div className="flex items-center justify-between gap-3 sm:contents">
                <span className="shrink-0 rounded-full bg-icon-category/15 px-3 py-1.5 text-xs font-semibold text-icon-category">
                  {tCat(faq.category)}
                </span>

                <div className="flex shrink-0 items-center gap-0.5">
                  {canDelete && (
                    <ConfirmActionButton
                      icon={<Trash2 className="size-4" />}
                      label={t("delete")}
                      destructive
                      confirmTitle={t("deleteConfirmTitle")}
                      confirmBody={t("deleteConfirmBody")}
                      confirmActionLabel={t("deleteConfirmAction")}
                      cancelLabel={t("deleteConfirmCancel")}
                      onConfirm={() => deleteFaqAction(faq.id)}
                    />
                  )}
                  {canEdit && (
                    <FaqDialog
                      mode="edit"
                      faq={faq}
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
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    aria-label={isOpen ? "Collapse" : "Expand"}
                    aria-expanded={isOpen}
                    onClick={() => toggle(faq.id)}
                  >
                    <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                  </Button>
                </div>
              </div>
            </div>

            {isOpen && (
              <div className="flex flex-col gap-2 px-3 pb-3">
                {faq.answer.en && (
                  <div className={cn("rounded-lg bg-muted p-3 text-sm", questionAlign)} dir="ltr" lang="en">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      English
                    </div>
                    {faq.answer.en}
                  </div>
                )}
                {faq.answer.ar && (
                  <div className={cn("rounded-lg bg-muted p-3 text-sm", questionAlign)} dir="rtl" lang="ar">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      العربية
                    </div>
                    {faq.answer.ar}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
