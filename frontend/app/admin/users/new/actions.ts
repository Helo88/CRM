"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

const permissionsField = z.string().transform((val, ctx) => {
  try {
    const parsed = JSON.parse(val);
    if (!Array.isArray(parsed) || !parsed.every((p) => typeof p === "string")) throw new Error();
    return parsed as string[];
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid permissions" });
    return z.NEVER;
  }
});

const newStaffAccountSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().min(1).email(),
  password: z.string().min(8),
  role: z.enum(["agent", "subadmin"]),
  // Serialized as a JSON string in a hidden input by the stepper's step 2
  // (PermissionsStep) — z can't validate a string[] straight out of FormData.
  permissions: permissionsField,
});

export interface NewStaffAccountActionState {
  error: string | null;
  fieldErrors?: { name?: string; email?: string; password?: string; role?: string };
}

export async function createStaffAccount(
  _prevState: NewStaffAccountActionState,
  formData: FormData
): Promise<NewStaffAccountActionState> {
  const t = await getTranslations("NewStaffAccount");
  const parsed = newStaffAccountSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    permissions: formData.get("permissions") ?? "[]",
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      fieldErrors: {
        name: fieldErrors.name ? t("nameRequired") : undefined,
        email: fieldErrors.email ? t("invalidEmail") : undefined,
        password: fieldErrors.password ? t("passwordTooShort") : undefined,
        role: fieldErrors.role ? t("genericError") : undefined,
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

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(parsed.data),
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

  redirect("/admin/users");
}
