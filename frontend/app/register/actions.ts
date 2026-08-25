"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";

const registerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().min(1).email(),
  password: z.string().min(8),
});

export interface AuthActionState {
  error: string | null;
  fieldErrors?: { name?: string; email?: string; password?: string };
}

export async function register(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const t = await getTranslations("Register");
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      fieldErrors: {
        name: fieldErrors.name ? t("nameRequired") : undefined,
        email: fieldErrors.email ? t("invalidEmail") : undefined,
        password: fieldErrors.password ? t("passwordTooShort") : undefined,
      },
    };
  }

  const backendRes = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  const data = await backendRes.json();

  if (!backendRes.ok) {
    return { error: data.error ?? t("genericError") };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  redirect("/settings");
}
