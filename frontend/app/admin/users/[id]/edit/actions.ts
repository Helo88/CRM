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

// name/email/role/permissions are all optional here — a viewer without
// staff:edit or staff:permissions gets those form fields disabled, so their
// values are only meaningful (and only sent to the backend at all) when the
// matching canEditDetails/canEditPermissions flag says so. Without this, a
// viewer with ONLY staff:edit would have their unrelated, unchanged
// permissions value re-submitted on every save and get a spurious 403 for a
// staff:permissions check they never triggered.
const editStaffAccountSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1).email().optional(),
  role: z.enum(["agent", "subadmin"]).optional(),
  permissions: permissionsField.optional(),
});

export interface EditStaffAccountActionState {
  error: string | null;
  fieldErrors?: { name?: string; email?: string; role?: string };
}

export async function updateStaffAccount(
  userId: string,
  canEditDetails: boolean,
  canEditPermissions: boolean,
  _prevState: EditStaffAccountActionState,
  formData: FormData
): Promise<EditStaffAccountActionState> {
  const t = await getTranslations("EditStaffAccount");

  const rawName = formData.get("name");
  const rawEmail = formData.get("email");
  const rawRole = formData.get("role");
  const rawPermissions = formData.get("permissions");

  const parsed = editStaffAccountSchema.safeParse({
    name: canEditDetails && typeof rawName === "string" ? rawName : undefined,
    email: canEditDetails && typeof rawEmail === "string" ? rawEmail : undefined,
    role: canEditDetails && typeof rawRole === "string" ? rawRole : undefined,
    permissions: canEditPermissions && typeof rawPermissions === "string" ? rawPermissions : undefined,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      fieldErrors: {
        name: fieldErrors.name ? t("nameRequired") : undefined,
        email: fieldErrors.email ? t("invalidEmail") : undefined,
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

  // parsed.data only carries keys the viewer is actually authorized to
  // change (see above) — JSON.stringify drops the rest since they're
  // undefined, so the PATCH body only ever reflects an authorized edit.
  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/admin/users/${userId}`, {
      method: "PATCH",
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
