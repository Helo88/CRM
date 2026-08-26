"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

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
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { error: "Not signed in", message: null };
  }

  const { phone, ...rest } = parsed.data;
  const body = { ...rest, phone: phone.length > 0 ? phone : null };

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(body),
    });

  // Inline refresh-and-retry, not a redirect — see settings/actions.ts for
  // why (a redirect here would silently drop this profile-edit submission).
  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { error: "Not signed in", message: null };
    }
    res = await doFetch(refreshedToken);
  }
  const data = await res.json();

  if (!res.ok) {
    return { error: data.error ?? t("genericError"), message: null };
  }

  revalidatePath(`/customers/${id}`);
  return { error: null, message: t("saved") };
}
