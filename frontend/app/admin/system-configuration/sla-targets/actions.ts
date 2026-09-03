"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

export interface SlaTargetActionState {
  error: string | null;
}

async function getBearerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) return token;
  return refreshSession();
}

async function mapBackendError(status: number, data: { error?: string }): Promise<string> {
  const t = await getTranslations("AdminSlaTargets");
  if (status === 403) return t("noAccess");
  if (data.error?.includes("already exists")) return t("errorDuplicate");
  if (data.error?.includes("resolutionMinutes must be")) return t("errorResolutionLessThanResponse");
  if (data.error?.includes("default SLA target must remain")) return t("errorCannotEditDefaultKeys");
  if (data.error?.includes("cannot be deleted")) return t("errorCannotDeleteDefault");
  return t("genericError");
}

export interface SlaTargetInput {
  priority: string | null;
  category: string | null;
  responseMinutes: number;
  resolutionMinutes: number;
}

export async function createSlaTarget(input: SlaTargetInput): Promise<SlaTargetActionState> {
  const t = await getTranslations("AdminSlaTargets");
  const token = await getBearerToken();
  if (!token) return { error: t("notSignedIn") };

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/sla-targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(input),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) return { error: t("notSignedIn") };
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    const data = await res.json();
    return { error: await mapBackendError(res.status, data) };
  }

  revalidatePath("/admin/system-configuration/sla-targets");
  return { error: null };
}

export async function updateSlaTarget(id: string, input: Partial<SlaTargetInput>): Promise<SlaTargetActionState> {
  const t = await getTranslations("AdminSlaTargets");
  const token = await getBearerToken();
  if (!token) return { error: t("notSignedIn") };

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/sla-targets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(input),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) return { error: t("notSignedIn") };
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    const data = await res.json();
    return { error: await mapBackendError(res.status, data) };
  }

  revalidatePath("/admin/system-configuration/sla-targets");
  return { error: null };
}

export async function deleteSlaTarget(id: string): Promise<SlaTargetActionState> {
  const t = await getTranslations("AdminSlaTargets");
  const token = await getBearerToken();
  if (!token) return { error: t("notSignedIn") };

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/sla-targets/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) return { error: t("notSignedIn") };
    res = await doFetch(refreshedToken);
  }

  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    return { error: await mapBackendError(res.status, data) };
  }

  revalidatePath("/admin/system-configuration/sla-targets");
  return { error: null };
}

export interface SlaSystemSettingsInput {
  atRiskPercent?: number;
  scanIntervalMinutes?: number;
}

export async function updateSlaSystemSettings(input: SlaSystemSettingsInput): Promise<SlaTargetActionState> {
  const t = await getTranslations("AdminSlaTargets");
  const token = await getBearerToken();
  if (!token) return { error: t("notSignedIn") };

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/sla-targets/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(input),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) return { error: t("notSignedIn") };
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    if (res.status === 403) return { error: t("noAccess") };
    return { error: t("settings.saveFailed") };
  }

  revalidatePath("/admin/system-configuration/sla-targets");
  return { error: null };
}
