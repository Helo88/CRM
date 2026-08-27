"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { API_URL } from "@/lib/auth";
import { setSessionCookies } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(1),
});

export interface AuthActionState {
  error: string | null;
  fieldErrors?: { email?: string; password?: string };
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const t = await getTranslations("Login");
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      fieldErrors: {
        email: fieldErrors.email ? t("invalidEmail") : undefined,
        password: fieldErrors.password ? t("passwordRequired") : undefined,
      },
    };
  }

  const backendRes = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  const data = await backendRes.json();

  if (!backendRes.ok) {
    // Backend has no i18n of its own (separate service, plain error
    // strings) — it always returns the exact same English string here by
    // design (anti-enumeration, see auth.routes.ts), so translate it here
    // rather than ever showing the raw backend text.
    return { error: backendRes.status === 401 ? t("invalidCredentials") : t("genericError") };
  }

  await setSessionCookies(data.token, data.refreshToken);

  redirect("/settings");
}
