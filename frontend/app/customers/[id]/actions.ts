"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";
import { isValidPhone } from "@/lib/phone";

const profileSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().min(1).email(),
  phone: z.string().trim().refine((v) => v === "" || isValidPhone(v)),
});

export interface ProfileActionState {
  error: string | null;
  message: string | null;
  fieldErrors?: { name?: string; email?: string; phone?: string };
}

export async function updateProfile(
  id: string,
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const t = await getTranslations("CustomerProfile");
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      message: null,
      fieldErrors: {
        name: fieldErrors.name ? t("nameRequired") : undefined,
        email: fieldErrors.email ? t("invalidEmail") : undefined,
        phone: fieldErrors.phone ? t("invalidPhone") : undefined,
      },
    };
  }

  const tAuth = await getTranslations("Auth");
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { error: tAuth("notSignedIn"), message: null };
  }

  const { phone, ...rest } = parsed.data;
  const body = { ...rest, phone: phone.length > 0 ? phone : null };

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(body),
    });

  // Inline refresh-and-retry, not a redirect — see settings/actions.ts for
  // why (a redirect here would silently drop this profile-edit submission).
  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { error: tAuth("notSignedIn"), message: null };
    }
    res = await doFetch(refreshedToken);
  }
  const data = await res.json();

  if (!res.ok) {
    // Backend has no i18n of its own — map its known, reachable error
    // strings to translated copy rather than showing raw English.
    if (res.status === 409) {
      return { error: t("emailInUse"), message: null };
    }
    if (res.status === 403) {
      return { error: t("noPermission"), message: null };
    }
    return { error: t("genericError"), message: null };
  }

  revalidatePath(`/customers/${id}`);
  return { error: null, message: t("saved") };
}

export interface UploadActionState {
  error: string | null;
}

const INITIAL_UPLOAD_STATE: UploadActionState = { error: null };

// Shared by uploadAttachments/replaceIdDocument — both forward a multipart
// FormData (containing File entries) straight through to the backend, never
// touching Content-Type themselves (fetch sets the correct multipart
// boundary from the FormData body automatically).
async function doMultipartRequest(
  path: string,
  method: "POST" | "PUT",
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tAuth = await getTranslations("Auth");
  const t = await getTranslations("CustomerProfile");
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { ok: false, error: tAuth("notSignedIn") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}${path}`, { method, headers: { Authorization: `Bearer ${bearer}` }, body: formData });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { ok: false, error: tAuth("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (data?.error === "UNSUPPORTED_FILE_TYPE") {
      return { ok: false, error: t("unsupportedFileType") };
    }
    if (res.status === 413) {
      return { ok: false, error: t("fileTooLarge") };
    }
    return { ok: false, error: t("genericError") };
  }

  return { ok: true };
}

export async function addInternalNote(
  customerId: string,
  _prevState: UploadActionState,
  formData: FormData
): Promise<UploadActionState> {
  const t = await getTranslations("CustomerProfile");
  const text = formData.get("text");
  if (typeof text !== "string" || text.trim().length === 0) {
    return { error: t("noteRequired") };
  }

  const tAuth = await getTranslations("Auth");
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { error: tAuth("notSignedIn") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/customers/${customerId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ text: text.trim() }),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { error: tAuth("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }
  if (!res.ok) {
    return { error: t("genericError") };
  }

  revalidatePath(`/customers/${customerId}`);
  return { error: null };
}

export async function uploadAttachments(
  customerId: string,
  _prevState: UploadActionState,
  formData: FormData
): Promise<UploadActionState> {
  const result = await doMultipartRequest(`/api/v1/customers/${customerId}/attachments`, "POST", formData);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/customers/${customerId}`);
  return INITIAL_UPLOAD_STATE;
}

export async function replaceIdDocument(
  customerId: string,
  _prevState: UploadActionState,
  formData: FormData
): Promise<UploadActionState> {
  const result = await doMultipartRequest(`/api/v1/customers/${customerId}/id-document`, "PUT", formData);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/customers/${customerId}`);
  return INITIAL_UPLOAD_STATE;
}

export async function editInternalNote(
  customerId: string,
  noteId: string,
  _prevState: UploadActionState,
  formData: FormData
): Promise<UploadActionState> {
  const t = await getTranslations("CustomerProfile");
  const text = formData.get("text");
  if (typeof text !== "string" || text.trim().length === 0) {
    return { error: t("noteRequired") };
  }

  const tAuth = await getTranslations("Auth");
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { error: tAuth("notSignedIn") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/customers/${customerId}/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ text: text.trim() }),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { error: tAuth("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }
  if (!res.ok) {
    return { error: t("genericError") };
  }

  revalidatePath(`/customers/${customerId}`);
  return { error: null };
}

export async function deleteAttachment(customerId: string, attachmentId: string): Promise<{ error: string | null }> {
  const t = await getTranslations("CustomerProfile");
  const tAuth = await getTranslations("Auth");
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { error: tAuth("notSignedIn") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/customers/${customerId}/attachments/${attachmentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { error: tAuth("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }
  if (!res.ok) {
    return { error: t("genericError") };
  }

  revalidatePath(`/customers/${customerId}`);
  return { error: null };
}
