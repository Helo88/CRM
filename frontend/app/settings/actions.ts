"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
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
  const phone = String(formData.get("phone") ?? "");
  const { ok, data } = await callContactApi({ phone });
  if (!ok) return { error: data.error ?? "Could not update phone.", message: null };
  revalidatePath("/settings");
  return { error: null, message: "Phone updated" };
}

export async function updateEmail(
  _prevState: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  const email = String(formData.get("email") ?? "");
  const { ok, data } = await callContactApi({ email });
  if (!ok) return { error: data.error ?? "Could not update email.", message: null };
  revalidatePath("/settings");
  return { error: null, message: `Confirmation email sent to ${email}. Click the link to complete the change.` };
}
