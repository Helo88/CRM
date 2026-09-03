import { API_URL } from "@/lib/auth";
import type { LocalizedText } from "@/lib/localized";
import type { KbCategorySlug } from "@/lib/kb";

// Public knowledge-base reads. No Authorization header — deliberately: this
// is published content, meant to work for a signed-out visitor. `next:
// { revalidate }` rather than the `cache: "no-store"` every AUTHENTICATED
// page in this app uses — this response is identical for every visitor and
// is served to crawlers. The admin Server Actions (kb/faqs, kb/articles)
// revalidatePath("/help") on every create/edit/delete, so a change is live
// immediately; the timer only covers a change made outside the app.
export const KB_REVALIDATE_SECONDS = 300;

export interface PublicFaq {
  id: string;
  question: LocalizedText;
  answer: LocalizedText;
  category: KbCategorySlug;
  updatedAt: string;
}

export interface PublicArticleListItem {
  id: string;
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  category: KbCategorySlug;
  updatedAt: string;
}

export interface PublicArticle extends PublicArticleListItem {
  body: LocalizedText;
}

interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchPublicFaqs(params: {
  category?: string;
  page?: number;
  limit?: number;
}): Promise<ListResult<PublicFaq>> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 10));

  try {
    const res = await fetch(`${API_URL}/api/v1/kb/public/faqs?${query.toString()}`, {
      next: { revalidate: KB_REVALIDATE_SECONDS },
    });
    if (!res.ok) return { items: [], total: 0, page: 1, limit: params.limit ?? 10 };
    const data = await res.json();
    return { items: data.faqs ?? [], total: data.total ?? 0, page: data.page ?? 1, limit: data.limit ?? 10 };
  } catch (err) {
    console.error("[kbPublic] fetchPublicFaqs failed:", err);
    return { items: [], total: 0, page: 1, limit: params.limit ?? 10 };
  }
}

export async function fetchPublicArticles(params: {
  category?: string;
  page?: number;
  limit?: number;
}): Promise<ListResult<PublicArticleListItem>> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 10));

  try {
    const res = await fetch(`${API_URL}/api/v1/kb/public/articles?${query.toString()}`, {
      next: { revalidate: KB_REVALIDATE_SECONDS },
    });
    if (!res.ok) return { items: [], total: 0, page: 1, limit: params.limit ?? 10 };
    const data = await res.json();
    return { items: data.articles ?? [], total: data.total ?? 0, page: data.page ?? 1, limit: data.limit ?? 10 };
  } catch (err) {
    console.error("[kbPublic] fetchPublicArticles failed:", err);
    return { items: [], total: 0, page: 1, limit: params.limit ?? 10 };
  }
}

export async function fetchPublicArticle(slug: string): Promise<PublicArticle | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/kb/public/articles/${encodeURIComponent(slug)}`, {
      next: { revalidate: KB_REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error("[kbPublic] fetchPublicArticle failed:", err);
    return null;
  }
}
