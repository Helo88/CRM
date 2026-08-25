"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";

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
    return { error: data.error ?? t("genericError") };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days, matches backend's default JWT_EXPIRES_IN
  });

  redirect("/settings");
}
