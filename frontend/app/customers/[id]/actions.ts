"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";

const profileSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().min(1).email(),
  phone: z.string().trim(),
  preferredLanguage: z.enum(["en", "ar"]),
});

export interface ProfileActionState {
  error: string | null;
  message: string | null;
  fieldErrors?: { name?: string; email?: string };
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
    preferredLanguage: formData.get("preferredLanguage"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      message: null,
      fieldErrors: {
        name: fieldErrors.name ? t("nameRequired") : undefined,
        email: fieldErrors.email ? t("invalidEmail") : undefined,
      },
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return { error: "Not signed in", message: null };
  }

  const { phone, ...rest } = parsed.data;
  const body = { ...rest, phone: phone.length > 0 ? phone : null };

  const res = await fetch(`${API_URL}/api/v1/customers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();

  if (!res.ok) {
    return { error: data.error ?? t("genericError"), message: null };
  }

  revalidatePath(`/customers/${id}`);
  return { error: null, message: t("saved") };
}
