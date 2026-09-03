"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArticleBody } from "@/components/ArticleBody";
import { KB_CATEGORY_SLUGS } from "@/lib/kb";
import {
  createArticleAction,
  updateArticleAction,
  translateArticleField,
  fetchArticleForEdit,
  type ArticleListItem,
  type ArticleRecord,
} from "./actions";

type Field = "title" | "summary" | "body";

// Same dialog-not-route shape as FaqDialog (Story 29) — see that file's
// header comment. `article` here is only the LIST item (no body — the list
// endpoint omits it); opening in edit mode fetches the full record
// (including both bodies) once, on open.
export function ArticleDialog({
  mode,
  article,
  trigger,
}: {
  mode: "create" | "edit";
  article?: ArticleListItem;
  trigger: ReactNode;
}) {
  const t = useTranslations("ArticleDialog");
  const tCat = useTranslations("KbCategories");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [titleEn, setTitleEn] = useState(article?.title.en ?? "");
  const [titleAr, setTitleAr] = useState(article?.title.ar ?? "");
  const [summaryEn, setSummaryEn] = useState(article?.summary.en ?? "");
  const [summaryAr, setSummaryAr] = useState(article?.summary.ar ?? "");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyAr, setBodyAr] = useState("");
  const [slug, setSlug] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState<string>(article?.category ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [translating, setTranslating] = useState<Field | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState<Field | null>(null);
  const [pending, startTransition] = useTransition();

  function resetFromListItem() {
    setTitleEn(article?.title.en ?? "");
    setTitleAr(article?.title.ar ?? "");
    setSummaryEn(article?.summary.en ?? "");
    setSummaryAr(article?.summary.ar ?? "");
    setBodyEn("");
    setBodyAr("");
    setSlug(undefined);
    setCategory(article?.category ?? "");
    setError(null);
    setFieldErrors({});
    setAiUnavailable(null);
  }

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    resetFromListItem();
    if (mode === "edit" && article) {
      setLoading(true);
      const full: ArticleRecord | null = await fetchArticleForEdit(article.id);
      setLoading(false);
      if (full) {
        setBodyEn(full.body.en);
        setBodyAr(full.body.ar);
      }
    }
  }

  async function handleTranslate(field: Field) {
    const [en, ar] =
      field === "title" ? [titleEn, titleAr] : field === "summary" ? [summaryEn, summaryAr] : [bodyEn, bodyAr];
    const from = en.trim() ? "en" : ar.trim() ? "ar" : null;
    if (!from || (en.trim() && ar.trim())) return;
    const to = from === "en" ? "ar" : "en";
    setTranslating(field);
    setAiUnavailable(null);
    const { translation } = await translateArticleField({ field, from, to, text: from === "en" ? en : ar });
    setTranslating(null);
    if (translation === null) {
      setAiUnavailable(field);
      return;
    }
    if (field === "title") (to === "ar" ? setTitleAr : setTitleEn)(translation);
    else if (field === "summary") (to === "ar" ? setSummaryAr : setSummaryEn)(translation);
    else (to === "ar" ? setBodyAr : setBodyEn)(translation);
  }

  function submit() {
    const input = { titleEn, titleAr, summaryEn, summaryAr, bodyEn, bodyAr, category, slug };
    startTransition(async () => {
      const result =
        mode === "create" ? await createArticleAction(input) : await updateArticleAction(article!.id, input);
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        setError(null);
      } else if (result.error) {
        setError(result.error);
        setFieldErrors({});
      } else {
        setOpen(false);
      }
    });
  }

  const canTranslate = (en: string, ar: string) => Boolean(en.trim()) !== Boolean(ar.trim());

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("newTitle") : t("editTitle")}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-invalid={Boolean(fieldErrors.category)}>
                  <SelectValue placeholder={t("categoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {KB_CATEGORY_SLUGS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {tCat(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.category && <p className="text-sm text-destructive">{fieldErrors.category[0]}</p>}
            </div>

            {mode === "create" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="article-slug">{t("slug")}</Label>
                <Input
                  id="article-slug"
                  value={slug ?? ""}
                  onChange={(e) => setSlug(e.target.value || undefined)}
                  placeholder="example-article-title"
                  dir="ltr"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">{t("slugHint")}</p>
                <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                  squadcrm.com/help/{slug || "…"}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="article-title-en">{t("titleEn")}</Label>
                <Input id="article-title-en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} maxLength={200} aria-invalid={Boolean(fieldErrors.titleEn)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="article-title-ar">{t("titleAr")}</Label>
                <Input id="article-title-ar" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} maxLength={200} dir="rtl" lang="ar" aria-invalid={Boolean(fieldErrors.titleEn)} />
              </div>
              {fieldErrors.titleEn && <p className="text-sm text-destructive">{fieldErrors.titleEn[0]}</p>}
              {canTranslate(titleEn, titleAr) && (
                <Button type="button" variant="ghost" size="sm" className="w-fit border-primary/40 bg-primary/10 text-primary hover:border-primary/60 hover:bg-primary/20 hover:text-primary" disabled={translating === "title"} onClick={() => handleTranslate("title")}>
                  <Sparkles className="size-3.5" />
                  {translating === "title" ? t("aiTranslating") : t("aiTranslate")}
                </Button>
              )}
              {aiUnavailable === "title" && <p className="text-xs text-muted-foreground">{t("aiUnavailable")}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="article-summary-en">{t("summaryEn")}</Label>
                <Textarea id="article-summary-en" value={summaryEn} onChange={(e) => setSummaryEn(e.target.value)} maxLength={400} rows={2} aria-invalid={Boolean(fieldErrors.summaryEn)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="article-summary-ar">{t("summaryAr")}</Label>
                <Textarea id="article-summary-ar" value={summaryAr} onChange={(e) => setSummaryAr(e.target.value)} maxLength={400} rows={2} dir="rtl" lang="ar" aria-invalid={Boolean(fieldErrors.summaryEn)} />
              </div>
              {fieldErrors.summaryEn && <p className="text-sm text-destructive">{fieldErrors.summaryEn[0]}</p>}
              {canTranslate(summaryEn, summaryAr) && (
                <Button type="button" variant="ghost" size="sm" className="w-fit border-primary/40 bg-primary/10 text-primary hover:border-primary/60 hover:bg-primary/20 hover:text-primary" disabled={translating === "summary"} onClick={() => handleTranslate("summary")}>
                  <Sparkles className="size-3.5" />
                  {translating === "summary" ? t("aiTranslating") : t("aiTranslate")}
                </Button>
              )}
              {aiUnavailable === "summary" && <p className="text-xs text-muted-foreground">{t("aiUnavailable")}</p>}
            </div>

            <BodyField label={t("bodyEn")} value={bodyEn} onChange={setBodyEn} dir="ltr" hint={t("markdownHint")} invalid={Boolean(fieldErrors.bodyEn)} />
            <BodyField label={t("bodyAr")} value={bodyAr} onChange={setBodyAr} dir="rtl" hint={t("markdownHint")} invalid={Boolean(fieldErrors.bodyEn)} />
            {fieldErrors.bodyEn && <p className="text-sm text-destructive">{fieldErrors.bodyEn[0]}</p>}
            {canTranslate(bodyEn, bodyAr) && (
              <Button type="button" variant="ghost" size="sm" className="w-fit border-primary/40 bg-primary/10 text-primary hover:border-primary/60 hover:bg-primary/20 hover:text-primary" disabled={translating === "body"} onClick={() => handleTranslate("body")}>
                <Sparkles className="size-3.5" />
                {translating === "body" ? t("aiTranslating") : t("aiTranslate")}
              </Button>
            )}
            {aiUnavailable === "body" && <p className="text-xs text-muted-foreground">{t("aiUnavailable")}</p>}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" disabled={pending || loading} onClick={submit}>
            {pending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BodyField({
  label,
  value,
  onChange,
  dir,
  hint,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dir: "ltr" | "rtl";
  hint: string;
  invalid: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="write">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={50000}
            rows={6}
            dir={dir}
            lang={dir === "rtl" ? "ar" : "en"}
            className="font-mono text-sm"
            aria-invalid={invalid}
          />
          {/* Markdown syntax examples are literal LTR punctuation (##, ![]())
              — forced dir="ltr" regardless of UI language, or the bidi
              algorithm visually reorders the brackets/parens when this sits
              inside an RTL ancestor (same reason code blocks stay LTR in
              RTL documentation). */}
          <p className="mt-1 text-start text-xs text-muted-foreground" dir="ltr">
            {hint}
          </p>
        </TabsContent>
        <TabsContent value="preview">
          <div className="rounded-lg border border-border p-3">
            <ArticleBody markdown={value} lang={dir === "rtl" ? "ar" : "en"} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
