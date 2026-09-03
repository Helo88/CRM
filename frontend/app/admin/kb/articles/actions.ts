"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";
import type { KbCategorySlug } from "@/lib/kb";

export interface ArticleActionState {
  error: string | null;
  fieldErrors?: Record<string, string[]>;
}

export interface ArticleListItem {
  id: string;
  slug: string;
  title: { en: string; ar: string };
  summary: { en: string; ar: string };
  category: KbCategorySlug;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleRecord extends ArticleListItem {
  body: { en: string; ar: string };
}

async function getBearerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) return token;
  return refreshSession();
}

async function mapBackendError(status: number, data: { error?: string }): Promise<string> {
  const t = await getTranslations("ArticleDialog");
  if (status === 403) return t("noAccess");
  if (data.error?.includes("URL slug already exists")) return t("errorSlugTaken");
  if (data.error?.startsWith("title")) return t("titleRequired");
  if (data.error?.startsWith("summary")) return t("summaryRequired");
  if (data.error?.startsWith("body")) return t("bodyRequired");
  return t("genericError");
}

const articleFormSchema = z
  .object({
    titleEn: z.string().trim().max(200),
    titleAr: z.string().trim().max(200),
    summaryEn: z.string().trim().max(400),
    summaryAr: z.string().trim().max(400),
    bodyEn: z.string().trim().max(50000),
    bodyAr: z.string().trim().max(50000),
    category: z.string().min(1),
    slug: z.string().trim().max(120).optional(),
  })
  .refine((v) => Boolean(v.titleEn || v.titleAr), { message: "titleRequired", path: ["titleEn"] })
  .refine((v) => Boolean(v.summaryEn || v.summaryAr), { message: "summaryRequired", path: ["summaryEn"] })
  .refine((v) => Boolean(v.bodyEn || v.bodyAr), { message: "bodyRequired", path: ["bodyEn"] });

export interface ArticleFormInput {
  titleEn: string;
  titleAr: string;
  summaryEn: string;
  summaryAr: string;
  bodyEn: string;
  bodyAr: string;
  category: string;
  slug?: string;
}

async function buildFieldErrors(parsed: z.ZodError): Promise<Record<string, string[]>> {
  const t = await getTranslations("ArticleDialog");
  const errors: Record<string, string[]> = {};
  for (const issue of parsed.issues) {
    const key = String(issue.path[0] ?? "form");
    const message =
      key === "category"
        ? t("categoryRequired")
        : key === "titleEn"
          ? t("titleRequired")
          : key === "summaryEn"
            ? t("summaryRequired")
            : key === "bodyEn"
              ? t("bodyRequired")
              : issue.message;
    errors[key] = [...(errors[key] ?? []), message];
  }
  return errors;
}

function buildBody(parsed: z.infer<typeof articleFormSchema>) {
  return {
    title: { en: parsed.titleEn, ar: parsed.titleAr },
    summary: { en: parsed.summaryEn, ar: parsed.summaryAr },
    body: { en: parsed.bodyEn, ar: parsed.bodyAr },
    category: parsed.category,
    ...(parsed.slug ? { slug: parsed.slug } : {}),
  };
}

export async function createArticleAction(input: ArticleFormInput): Promise<ArticleActionState> {
  const parsed = articleFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: null, fieldErrors: await buildFieldErrors(parsed.error) };
  }

  const token = await getBearerToken();
  if (!token) {
    const t = await getTranslations("ArticleDialog");
    return { error: t("notSignedIn") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/kb/articles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(buildBody(parsed.data)),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      const t = await getTranslations("ArticleDialog");
      return { error: t("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    const data = await res.json();
    return { error: await mapBackendError(res.status, data) };
  }

  revalidatePath("/admin/kb/articles");
  revalidatePath("/help");
  return { error: null };
}

export async function updateArticleAction(id: string, input: ArticleFormInput): Promise<ArticleActionState> {
  const parsed = articleFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: null, fieldErrors: await buildFieldErrors(parsed.error) };
  }

  const token = await getBearerToken();
  if (!token) {
    const t = await getTranslations("ArticleDialog");
    return { error: t("notSignedIn") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/kb/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(buildBody(parsed.data)),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      const t = await getTranslations("ArticleDialog");
      return { error: t("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    const data = await res.json();
    return { error: await mapBackendError(res.status, data) };
  }

  revalidatePath("/admin/kb/articles");
  revalidatePath("/help");
  return { error: null };
}

export async function deleteArticleAction(id: string): Promise<{ error: string | null }> {
  const t = await getTranslations("AdminArticles");
  const token = await getBearerToken();
  if (!token) return { error: t("notSignedIn") };

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/kb/articles/${id}`, {
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

  revalidatePath("/admin/kb/articles");
  revalidatePath("/help");
  return { error: null };
}

export async function fetchArticleForEdit(id: string): Promise<ArticleRecord | null> {
  const token = await getBearerToken();
  if (!token) return null;

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/kb/articles/${id}`, { headers: { Authorization: `Bearer ${bearer}` } });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) return null;
    res = await doFetch(refreshedToken);
  }
  if (!res.ok) return null;
  return res.json();
}

export async function translateArticleField(input: {
  field: "title" | "summary" | "body";
  from: "en" | "ar";
  to: "en" | "ar";
  text: string;
}): Promise<{ translation: string | null }> {
  const token = await getBearerToken();
  if (!token) {
    console.error("[translateArticleField] no bearer token — session cookie/refresh unavailable");
    return { translation: null };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/kb/articles/ai/translate`, {
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
        console.error("[translateArticleField] 401 and refresh failed");
        return { translation: null };
      }
      res = await doFetch(refreshedToken);
    }
  } catch (err) {
    console.error("[translateArticleField] fetch threw:", err);
    return { translation: null };
  }

  if (!res.ok) {
    console.error("[translateArticleField] backend responded", res.status, await res.text().catch(() => ""));
    return { translation: null };
  }

  const data = await res.json();
  return { translation: typeof data.translation === "string" ? data.translation : null };
}
