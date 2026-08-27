"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

export interface StaffAccountActionResult {
  error: string | null;
}

async function getBearerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) return token;
  return refreshSession();
}

// Story 45 (security-admin), Story 45 addendum for activate/delete. No
// redirect from any of these three — they stay on the roster page and rely
// on revalidatePath so the row reflects the new status without a full reload.
async function setStaffAccountActive(userId: string, isActive: boolean): Promise<StaffAccountActionResult> {
  const t = await getTranslations("AdminUsersList");
  let token = await getBearerToken();
  if (!token) {
    return { error: t(isActive ? "activateFailed" : "deactivateFailed") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/admin/users/${userId}/${isActive ? "activate" : "deactivate"}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${bearer}` },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    token = await refreshSession();
    if (!token) {
      return { error: t(isActive ? "activateFailed" : "deactivateFailed") };
    }
    res = await doFetch(token);
  }

  if (!res.ok) {
    // Not always reachable (a delegated sub-admin's caller-role usually
    // matches what's allowed), but kept honest rather than assumed
    // unreachable — see Story 46's admin-target cap.
    if (res.status === 403) return { error: t("cannotActOnAdmin") };
    return { error: t(isActive ? "activateFailed" : "deactivateFailed") };
  }

  revalidatePath("/admin/users");
  return { error: null };
}

export async function deactivateStaffAccount(userId: string): Promise<StaffAccountActionResult> {
  return setStaffAccountActive(userId, false);
}

export async function activateStaffAccount(userId: string): Promise<StaffAccountActionResult> {
  return setStaffAccountActive(userId, true);
}

export async function deleteStaffAccount(userId: string): Promise<StaffAccountActionResult> {
  const t = await getTranslations("AdminUsersList");
  let token = await getBearerToken();
  if (!token) {
    return { error: t("deleteFailed") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    token = await refreshSession();
    if (!token) {
      return { error: t("deleteFailed") };
    }
    res = await doFetch(token);
  }

  if (!res.ok && res.status !== 204) {
    if (res.status === 403) return { error: t("cannotActOnAdmin") };
    return { error: t("deleteFailed") };
  }

  revalidatePath("/admin/users");
  return { error: null };
}
