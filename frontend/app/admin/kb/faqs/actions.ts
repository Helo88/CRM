"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";
import type { KbCategorySlug } from "@/lib/kb";

export interface FaqActionState {
  error: string | null;
  fieldErrors?: Record<string, string[]>;
}

export interface FaqRecord {
  id: string;
  question: { en: string; ar: string };
  answer: { en: string; ar: string };
  category: KbCategorySlug;
  createdAt: string;
  updatedAt: string;
}

async function getBearerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) return token;
  return refreshSession();
}

async function mapBackendError(status: number, data: { error?: string }): Promise<string> {
  const t = await getTranslations("FaqDialog");
  if (status === 403) return t("noAccess");
  if (data.error?.includes("required in at least one language") && data.error?.startsWith("question")) {
    return t("questionRequired");
  }
  if (data.error?.includes("required in at least one language") && data.error?.startsWith("answer")) {
    return t("answerRequired");
  }
  return t("genericError");
}

const faqFormSchema = z
  .object({
    questionEn: z.string().trim().max(300),
    questionAr: z.string().trim().max(300),
    answerEn: z.string().trim().max(5000),
    answerAr: z.string().trim().max(5000),
    category: z.string().min(1),
  })
  .refine((v) => Boolean(v.questionEn || v.questionAr), {
    message: "Question is required in at least one language",
    path: ["questionEn"],
  })
  .refine((v) => Boolean(v.answerEn || v.answerAr), {
    message: "Answer is required in at least one language",
    path: ["answerEn"],
  });

export interface FaqFormInput {
  questionEn: string;
  questionAr: string;
  answerEn: string;
  answerAr: string;
  category: string;
}

async function buildFieldErrors(parsed: z.ZodError): Promise<Record<string, string[]>> {
  const t = await getTranslations("FaqDialog");
  const errors: Record<string, string[]> = {};
  for (const issue of parsed.issues) {
    const key = String(issue.path[0] ?? "form");
    const message =
      key === "category"
        ? t("categoryRequired")
        : key === "questionEn"
          ? t("questionRequired")
          : key === "answerEn"
            ? t("answerRequired")
            : issue.message;
    errors[key] = [...(errors[key] ?? []), message];
  }
  return errors;
}

export async function createFaqAction(input: FaqFormInput): Promise<FaqActionState> {
  const parsed = faqFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: null, fieldErrors: await buildFieldErrors(parsed.error) };
  }

  const token = await getBearerToken();
  if (!token) {
    const t = await getTranslations("FaqDialog");
    return { error: t("notSignedIn") };
  }

  const body = {
    question: { en: parsed.data.questionEn, ar: parsed.data.questionAr },
    answer: { en: parsed.data.answerEn, ar: parsed.data.answerAr },
    category: parsed.data.category,
  };

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/kb/faqs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(body),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      const t = await getTranslations("FaqDialog");
      return { error: t("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    const data = await res.json();
    return { error: await mapBackendError(res.status, data) };
  }

  revalidatePath("/admin/kb/faqs");
  revalidatePath("/help");
  return { error: null };
}

export async function updateFaqAction(id: string, input: FaqFormInput): Promise<FaqActionState> {
  const parsed = faqFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: null, fieldErrors: await buildFieldErrors(parsed.error) };
  }

  const token = await getBearerToken();
  if (!token) {
    const t = await getTranslations("FaqDialog");
    return { error: t("notSignedIn") };
  }

  const body = {
    question: { en: parsed.data.questionEn, ar: parsed.data.questionAr },
    answer: { en: parsed.data.answerEn, ar: parsed.data.answerAr },
    category: parsed.data.category,
  };

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/kb/faqs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(body),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      const t = await getTranslations("FaqDialog");
      return { error: t("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    const data = await res.json();
    return { error: await mapBackendError(res.status, data) };
  }

  revalidatePath("/admin/kb/faqs");
  revalidatePath("/help");
  return { error: null };
}

export async function deleteFaqAction(id: string): Promise<{ error: string | null }> {
  const t = await getTranslations("AdminFaqs");
  const token = await getBearerToken();
  if (!token) {
    return { error: t("notSignedIn") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/kb/faqs/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) return { error: t("notSignedIn") };
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    if (res.status === 403) return { error: t("noAccess") };
    return { error: t("deleteFailed") };
  }

  revalidatePath("/admin/kb/faqs");
  revalidatePath("/help");
  return { error: null };
}

export async function translateFaqField(input: {
  field: "question" | "answer";
  from: "en" | "ar";
  to: "en" | "ar";
  text: string;
}): Promise<{ translation: string | null }> {
  const token = await getBearerToken();
  if (!token) {
    console.error("[translateFaqField] no bearer token — session cookie/refresh unavailable");
    return { translation: null };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/kb/faqs/ai/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(input),
    });

  let res: Response;
  try {
    res = await doFetch(token);
    if (res.status === 401) {
      const refreshedToken = await refreshSession();
      if (!refreshedToken) {
        console.error("[translateFaqField] 401 and refresh failed");
        return { translation: null };
      }
      res = await doFetch(refreshedToken);
    }
  } catch (err) {
    // Network/connectivity failure reaching the backend — degrade quietly
    // for the admin (per CLAUDE.md's "never hang a flow on an external
    // call"), but this is exactly the kind of failure that must not be
    // silent server-side, or it's undiagnosable.
    console.error("[translateFaqField] fetch threw:", err);
    return { translation: null };
  }

  if (!res.ok) {
    console.error("[translateFaqField] backend responded", res.status, await res.text().catch(() => ""));
    return { translation: null };
  }

  const data = await res.json();
  return { translation: typeof data.translation === "string" ? data.translation : null };
}
