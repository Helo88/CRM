"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";
import { isValidPhone } from "@/lib/phone";

export interface ContactActionState {
  error: string | null;
  message: string | null;
}

// A Server Action, unlike a Server Component, CAN write cookies — so on a
// 401 it refreshes inline and retries once, rather than redirecting (a
// redirect here would silently drop the user's phone/email submission). See
// .squad/plans/auth/02-story-login-customer-agent-or-admin.md, "Addendum:
// Refresh token mechanism".
async function callContactApi(body: Record<string, string>) {
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { ok: false, data: { error: "Not signed in" } };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/me/contact`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(body),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { ok: false, status: 401, data: { error: "Not signed in" } };
    }
    res = await doFetch(refreshedToken);
  }
  return { ok: res.ok, status: res.status, data: await res.json() };
}

export async function updatePhone(
  _prevState: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  const t = await getTranslations("Settings");
  const phone = String(formData.get("phone") ?? "").trim();
  if (phone !== "" && !isValidPhone(phone)) {
    return { error: t("invalidPhone"), message: null };
  }
  const { ok, data } = await callContactApi({ phone });
  // Backend has no i18n of its own — the only realistic failure left here
  // (phone format is already validated above) is an auth hiccup, so a
  // generic translated fallback covers it; no need for per-string mapping.
  if (!ok) return { error: t("phoneUpdateFailed"), message: null };
  revalidatePath("/settings");
  return { error: null, message: t("phoneUpdated") };
}

export async function updateEmail(
  _prevState: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  const t = await getTranslations("Settings");
  const email = String(formData.get("email") ?? "");
  const { ok, status, data } = await callContactApi({ email });
  if (!ok) {
    // Backend has no i18n of its own — map its known, reachable error
    // strings to translated copy rather than showing raw English.
    if (data.error === "valid email is required") {
      return { error: t("invalidEmail"), message: null };
    }
    if (data.error === "This is already your current email") {
      return { error: t("emailUnchanged"), message: null };
    }
    if (status === 409) {
      return { error: t("emailInUse"), message: null };
    }
    if (status === 502) {
      return { error: t("emailSendFailed"), message: null };
    }
    return { error: t("emailUpdateFailed"), message: null };
  }
  revalidatePath("/settings");
  return { error: null, message: t("emailConfirmationSent", { email }) };
}
