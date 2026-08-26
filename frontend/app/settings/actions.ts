"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

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
      return { ok: false, data: { error: "Not signed in" } };
    }
    res = await doFetch(refreshedToken);
  }
  return { ok: res.ok, data: await res.json() };
}

export async function updatePhone(
  _prevState: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  const t = await getTranslations("Settings");
  const phone = String(formData.get("phone") ?? "");
  const { ok, data } = await callContactApi({ phone });
  if (!ok) return { error: data.error ?? t("phoneUpdateFailed"), message: null };
  revalidatePath("/settings");
  return { error: null, message: t("phoneUpdated") };
}

export async function updateEmail(
  _prevState: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  const t = await getTranslations("Settings");
  const email = String(formData.get("email") ?? "");
  const { ok, data } = await callContactApi({ email });
  if (!ok) return { error: data.error ?? t("emailUpdateFailed"), message: null };
  revalidatePath("/settings");
  return { error: null, message: t("emailConfirmationSent", { email }) };
}
