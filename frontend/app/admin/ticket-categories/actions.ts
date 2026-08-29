"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

export interface TicketCategoryActionState {
  error: string | null;
}

async function getBearerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) return token;
  return refreshSession();
}

// Backend has no i18n of its own — map its known, reachable error strings
// to translated copy rather than showing raw English (same convention as
// settings/actions.ts).
async function mapBackendError(status: number, data: { error?: string }): Promise<string> {
  const t = await getTranslations("AdminTicketCategories");
  if (status === 403) return t("noAccess");
  if (data.error === "A category with that name already exists.") return t("errorDuplicate");
  if (data.error?.includes("reactivate")) return t("errorDuplicateInactive");
  if (data.error?.includes("at most")) return t("errorTooLong");
  return t("genericError");
}

const nameSchema = z.string().trim().min(1).max(100);

export async function createTicketCategoryAction(
  _prevState: TicketCategoryActionState,
  formData: FormData
): Promise<TicketCategoryActionState> {
  const t = await getTranslations("NewTicketCategory");
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: t("nameRequired") };
  }

  const token = await getBearerToken();
  if (!token) {
    return { error: t("notSignedIn") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/ticket-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ name: parsed.data }),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) return { error: t("notSignedIn") };
    res = await doFetch(refreshedToken);
  }

  const data = await res.json();
  if (!res.ok) {
    if (data.error === "A category with that name already exists.") return { error: t("errorDuplicate") };
    if (data.error?.includes("reactivate")) return { error: t("errorDuplicateInactive") };
    if (data.error?.includes("at most")) return { error: t("errorTooLong") };
    return { error: t("genericError") };
  }

  revalidatePath("/admin/ticket-categories");
  return { error: null };
}

export async function renameTicketCategoryAction(id: string, name: string): Promise<TicketCategoryActionState> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    const t = await getTranslations("AdminTicketCategories");
    return { error: t("errorRequired") };
  }

  const token = await getBearerToken();
  if (!token) {
    const t = await getTranslations("AdminTicketCategories");
    return { error: t("notSignedIn") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/ticket-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ name: parsed.data }),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      const t = await getTranslations("AdminTicketCategories");
      return { error: t("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    const data = await res.json();
    return { error: await mapBackendError(res.status, data) };
  }

  revalidatePath("/admin/ticket-categories");
  return { error: null };
}

async function setTicketCategoryActive(id: string, active: boolean): Promise<TicketCategoryActionState> {
  const t = await getTranslations("AdminTicketCategories");
  const token = await getBearerToken();
  if (!token) {
    return { error: active ? t("reactivateFailed") : t("deactivateFailed") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/ticket-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ active }),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { error: active ? t("reactivateFailed") : t("deactivateFailed") };
    }
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    if (res.status === 403) return { error: t("noAccess") };
    return { error: active ? t("reactivateFailed") : t("deactivateFailed") };
  }

  revalidatePath("/admin/ticket-categories");
  return { error: null };
}

export async function deactivateTicketCategory(id: string): Promise<TicketCategoryActionState> {
  return setTicketCategoryActive(id, false);
}

export async function reactivateTicketCategory(id: string): Promise<TicketCategoryActionState> {
  return setTicketCategoryActive(id, true);
}
