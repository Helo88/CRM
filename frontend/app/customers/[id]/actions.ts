"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";
import { isValidPhone } from "@/lib/phone";

const profileSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().min(1).email(),
  phone: z.string().trim().refine((v) => v === "" || isValidPhone(v)),
});

export interface ProfileActionState {
  error: string | null;
  message: string | null;
  fieldErrors?: { name?: string; email?: string; phone?: string };
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
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      message: null,
      fieldErrors: {
        name: fieldErrors.name ? t("nameRequired") : undefined,
        email: fieldErrors.email ? t("invalidEmail") : undefined,
        phone: fieldErrors.phone ? t("invalidPhone") : undefined,
      },
    };
  }

  const tAuth = await getTranslations("Auth");
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { error: tAuth("notSignedIn"), message: null };
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
      return { error: tAuth("notSignedIn"), message: null };
    }
    res = await doFetch(refreshedToken);
  }
  const data = await res.json();

  if (!res.ok) {
    // Backend has no i18n of its own — map its known, reachable error
    // strings to translated copy rather than showing raw English.
    if (res.status === 409) {
      return { error: t("emailInUse"), message: null };
    }
    if (res.status === 403) {
      return { error: t("noPermission"), message: null };
    }
    return { error: t("genericError"), message: null };
  }

  revalidatePath(`/customers/${id}`);
  return { error: null, message: t("saved") };
}
