"use server";

import { cookies } from "next/headers";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

// Story 54: colocated at the top level, not under a route-scoped folder,
// same reasoning as actions/availability.ts — the notification bell lives
// in the header (SiteHeader), not on a single page.

export type NotificationType =
  | "ticket_assigned"
  | "ticket_escalated"
  | "ticket_reassigned"
  | "ticket_unassigned"
  | "ticket_created"
  | "ticket_auto_assigned"
  | "ticket_needs_assignment"
  | "ticket_reopened"
  | "ticket_reopened_oversight";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  ticket: { id: string; reference: string; subject: string };
}

async function getBearerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) return token;
  return refreshSession();
}

// Returns [] on any failure (signed out, network hiccup, backend down) —
// the bell has no error state of its own; an empty/unchanged list is the
// correct degraded behavior for a polling background fetch like this one.
// The try/catch is load-bearing, not defensive boilerplate: fetch() itself
// rejects (rather than resolving with a bad status) when the backend is
// unreachable, which previously escaped as an unhandled "fetch failed"
// TypeError that crashed the page render instead of degrading.
export async function fetchNotifications(): Promise<NotificationItem[]> {
  const token = await getBearerToken();
  if (!token) return [];

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/me/notifications`, {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: "no-store",
    });

  try {
    let res = await doFetch(token);
    if (res.status === 401) {
      const refreshedToken = await refreshSession();
      if (!refreshedToken) return [];
      res = await doFetch(refreshedToken);
    }
    if (!res.ok) return [];
    return (await res.json()) as NotificationItem[];
  } catch {
    return [];
  }
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const token = await getBearerToken();
  if (!token) return false;

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/me/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${bearer}` },
    });

  try {
    let res = await doFetch(token);
    if (res.status === 401) {
      const refreshedToken = await refreshSession();
      if (!refreshedToken) return false;
      res = await doFetch(refreshedToken);
    }
    return res.ok;
  } catch {
    return false;
  }
}
