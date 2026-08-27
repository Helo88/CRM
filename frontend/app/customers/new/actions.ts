"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";
import { isValidPhone } from "@/lib/phone";

const newCustomerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().min(1).email(),
  phone: z.string().trim().refine((v) => v === "" || isValidPhone(v)),
  password: z.string().min(8),
});

export interface NewCustomerActionState {
  error: string | null;
  fieldErrors?: { name?: string; email?: string; phone?: string; password?: string };
}

export async function createCustomer(
  _prevState: NewCustomerActionState,
  formData: FormData
): Promise<NewCustomerActionState> {
  const t = await getTranslations("NewCustomer");
  const parsed = newCustomerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      fieldErrors: {
        name: fieldErrors.name ? t("nameRequired") : undefined,
        email: fieldErrors.email ? t("invalidEmail") : undefined,
        phone: fieldErrors.phone ? t("invalidPhone") : undefined,
        password: fieldErrors.password ? t("passwordTooShort") : undefined,
      },
    };
  }

  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { error: t("notSignedIn") };
  }

  const { phone, ...rest } = parsed.data;
  const body = { ...rest, phone: phone.length > 0 ? phone : undefined };

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(body),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { error: t("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 409) return { error: t("emailInUse") };
    return { error: data.error ?? t("genericError") };
  }

  redirect("/customers");
}
