"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tag, ArrowDownUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FilterField } from "@/components/FilterField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KB_CATEGORY_SLUGS } from "@/lib/kb";

const ALL = "__all__";

// Same server-driven pattern as CustomerFilterBar/TicketFilterBar — every
// control rewrites the URL, reset to page 1 on any change, no client-held
// filter state.
export function FaqFilterBar() {
  const t = useTranslations("AdminFaqs");
  const tCat = useTranslations("KbCategories");
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get("category") ?? ALL;
  const sort = searchParams.get("sort") ?? "-updatedAt";
  const q = searchParams.get("q");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) params.delete(key);
    else params.set(key, value);
    params.delete("page");
    router.push(`/admin/kb/faqs?${params.toString()}`);
  }

  function clearSearch() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("page");
    router.push(`/admin/kb/faqs?${params.toString()}`);
  }

  const hasActiveFilter = category !== ALL || Boolean(q);

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card/50 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5 sm:gap-y-3">
        {q && (
          <FilterField label={t("filterSearch")}>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between border-primary/50 bg-primary/5 text-primary sm:w-auto"
              onClick={clearSearch}
            >
              <span className="max-w-40 truncate">{t("searchingFor", { query: q })}</span>
              <X className="size-3.5" />
            </Button>
          </FilterField>
        )}

        <FilterField label={t("filterCategory")}>
          <Select value={category} onValueChange={(v) => updateParam("category", v)}>
            <SelectTrigger
              className={cn("w-full sm:w-[11rem]", category !== ALL && "border-primary/50 bg-primary/5 text-primary")}
              size="sm"
            >
              <Tag className={cn("size-3.5", category !== ALL ? "text-primary" : "text-muted-foreground")} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filterAll")}</SelectItem>
              {KB_CATEGORY_SLUGS.map((slug) => (
                <SelectItem key={slug} value={slug}>
                  {tCat(slug)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label={t("sortLabel")} className="sm:ms-auto">
          <Select value={sort} onValueChange={(v) => updateParam("sort", v)}>
            <SelectTrigger className="w-full sm:w-52" size="sm">
              <ArrowDownUp className="size-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-updatedAt">{t("sortUpdatedDesc")}</SelectItem>
              <SelectItem value="updatedAt">{t("sortUpdatedAsc")}</SelectItem>
              <SelectItem value="-createdAt">{t("sortCreatedDesc")}</SelectItem>
              <SelectItem value="createdAt">{t("sortCreatedAsc")}</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </div>

      {hasActiveFilter && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => router.push("/admin/kb/faqs")}
          >
            <X className="size-3.5" />
            {t("resetFilters")}
          </Button>
        </div>
      )}
    </div>
  );
}
