"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";

export interface ContactActionState {
  error: string | null;
  message: string | null;
}

async function callContactApi(body: Record<string, string>) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return { ok: false, data: { error: "Not signed in" } };
  }
  const res = await fetch(`${API_URL}/api/v1/me/contact`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
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
