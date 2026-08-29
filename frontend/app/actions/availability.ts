"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

// Colocated at the top level, not under a route-scoped folder, because the
// availability toggle lives in the header (UserMenu), not on a single page.
// Follows frontend/app/settings/actions.ts's callContactApi pattern: a
// Server Action can write cookies directly, so it refreshes inline and
// retries once on a 401 rather than redirecting.
async function callAvailabilityApi(init: RequestInit) {
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { ok: false as const, data: null };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/me/availability`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}`, ...init.headers },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { ok: false as const, data: null };
    }
    res = await doFetch(refreshedToken);
  }
  if (!res.ok) {
    return { ok: false as const, data: null };
  }
  return { ok: true as const, data: (await res.json()) as { isOnline: boolean } };
}

export async function getAvailability(): Promise<boolean | null> {
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) return null;

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/me/status`, {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: "no-store",
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) return null;
    res = await doFetch(refreshedToken);
  }
  if (!res.ok) return null;
  const data = (await res.json()) as { isOnline?: boolean };
  return data.isOnline ?? false;
}

export async function setAvailability(isOnline: boolean): Promise<{ ok: boolean; isOnline: boolean | null }> {
  const { ok, data } = await callAvailabilityApi({ method: "PATCH", body: JSON.stringify({ isOnline }) });
  if (!ok || !data) return { ok: false, isOnline: null };
  // Revalidate the pages an agent lands on most so any server-rendered
  // online/offline indicator (e.g. the admin staff list) reflects the flip
  // without a manual refresh.
  revalidatePath("/tickets");
  revalidatePath("/admin/users");
  return { ok: true, isOnline: data.isOnline };
}
