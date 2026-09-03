"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { KB_CATEGORY_SLUGS, type KbCategorySlug } from "@/lib/kb";
import { createFaqAction, updateFaqAction, translateFaqField, type FaqRecord } from "./actions";

// Add/edit is a DIALOG, not a route — the whole point of this component is
// that "New FAQ" and a row's edit icon both open this same form in place,
// so an admin never leaves the list. See the knowledge-base concept review
// this was built from: dialogs for FAQ/article authoring, never a
// /admin/kb/faqs/[id]/edit page.
export function FaqDialog({
  mode,
  faq,
  trigger,
}: {
  mode: "create" | "edit";
  faq?: FaqRecord;
  trigger: ReactNode;
}) {
  const t = useTranslations("FaqDialog");
  const tCat = useTranslations("KbCategories");
  const [open, setOpen] = useState(false);
  const [questionEn, setQuestionEn] = useState(faq?.question.en ?? "");
  const [questionAr, setQuestionAr] = useState(faq?.question.ar ?? "");
  const [answerEn, setAnswerEn] = useState(faq?.answer.en ?? "");
  const [answerAr, setAnswerAr] = useState(faq?.answer.ar ?? "");
  const [category, setCategory] = useState<string>(faq?.category ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [translating, setTranslating] = useState<"question" | "answer" | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState<"question" | "answer" | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setQuestionEn(faq?.question.en ?? "");
    setQuestionAr(faq?.question.ar ?? "");
    setAnswerEn(faq?.answer.en ?? "");
    setAnswerAr(faq?.answer.ar ?? "");
    setCategory(faq?.category ?? "");
    setError(null);
    setFieldErrors({});
    setAiUnavailable(null);
  }

  async function handleTranslate(field: "question" | "answer") {
    const [en, ar] = field === "question" ? [questionEn, questionAr] : [answerEn, answerAr];
    const from = en.trim() ? "en" : ar.trim() ? "ar" : null;
    if (!from || (en.trim() && ar.trim())) return; // nothing to translate, or both already filled
    const to = from === "en" ? "ar" : "en";
    setTranslating(field);
    setAiUnavailable(null);
    const { translation } = await translateFaqField({ field, from, to, text: from === "en" ? en : ar });
    setTranslating(null);
    if (translation === null) {
      // Quiet, not an error toast/blocked submit — just a muted line so
      // the admin knows why nothing changed instead of it looking broken.
      setAiUnavailable(field);
      return;
    }
    if (field === "question") {
      if (to === "ar") setQuestionAr(translation);
      else setQuestionEn(translation);
    } else {
      if (to === "ar") setAnswerAr(translation);
      else setAnswerEn(translation);
    }
  }

  function submit() {
    const input = { questionEn, questionAr, answerEn, answerAr, category };
    startTransition(async () => {
      const result = mode === "create" ? await createFaqAction(input) : await updateFaqAction(faq!.id, input);
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

  const canTranslateQuestion = Boolean(questionEn.trim()) !== Boolean(questionAr.trim());
  const canTranslateAnswer = Boolean(answerEn.trim()) !== Boolean(answerAr.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("newTitle") : t("editTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("category")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-invalid={Boolean(fieldErrors.category)}>
                <SelectValue placeholder={t("categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {KB_CATEGORY_SLUGS.map((slug) => (
                  <SelectItem key={slug} value={slug}>
                    {tCat(slug)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.category && <p className="text-sm text-destructive">{fieldErrors.category[0]}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="faq-question-en">{t("questionEn")}</Label>
              <Input
                id="faq-question-en"
                value={questionEn}
                onChange={(e) => setQuestionEn(e.target.value)}
                maxLength={300}
                aria-invalid={Boolean(fieldErrors.questionEn)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="faq-question-ar">{t("questionAr")}</Label>
              <Input
                id="faq-question-ar"
                value={questionAr}
                onChange={(e) => setQuestionAr(e.target.value)}
                maxLength={300}
                dir="rtl"
                lang="ar"
                aria-invalid={Boolean(fieldErrors.questionEn)}
              />
            </div>
            {fieldErrors.questionEn && <p className="text-sm text-destructive">{fieldErrors.questionEn[0]}</p>}
            {canTranslateQuestion && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit border-primary/40 bg-primary/10 text-primary hover:border-primary/60 hover:bg-primary/20 hover:text-primary"
                disabled={translating === "question"}
                onClick={() => handleTranslate("question")}
              >
                <Sparkles className="size-3.5" />
                {translating === "question" ? t("aiTranslating") : t("aiTranslate")}
              </Button>
            )}
            {aiUnavailable === "question" && <p className="text-xs text-muted-foreground">{t("aiUnavailable")}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="faq-answer-en">{t("answerEn")}</Label>
              <Textarea
                id="faq-answer-en"
                value={answerEn}
                onChange={(e) => setAnswerEn(e.target.value)}
                maxLength={5000}
                rows={3}
                aria-invalid={Boolean(fieldErrors.answerEn)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="faq-answer-ar">{t("answerAr")}</Label>
              <Textarea
                id="faq-answer-ar"
                value={answerAr}
                onChange={(e) => setAnswerAr(e.target.value)}
                maxLength={5000}
                rows={3}
                dir="rtl"
                lang="ar"
                aria-invalid={Boolean(fieldErrors.answerEn)}
              />
            </div>
            {fieldErrors.answerEn && <p className="text-sm text-destructive">{fieldErrors.answerEn[0]}</p>}
            {canTranslateAnswer && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit border-primary/40 bg-primary/10 text-primary hover:border-primary/60 hover:bg-primary/20 hover:text-primary"
                disabled={translating === "answer"}
                onClick={() => handleTranslate("answer")}
              >
                <Sparkles className="size-3.5" />
                {translating === "answer" ? t("aiTranslating") : t("aiTranslate")}
              </Button>
            )}
            {aiUnavailable === "answer" && <p className="text-xs text-muted-foreground">{t("aiUnavailable")}</p>}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
