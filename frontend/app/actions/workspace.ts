"use server";

import { cookies } from "next/headers";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

// agent-workspace Story 35: colocated at the top level, same reasoning as
// actions/notifications.ts — this action backs both the dashboard page's
// server-rendered first paint and TriageBoard's client-side polling, so it
// isn't owned by either one of them.

// Mirrors backend/src/routes/me.routes.ts's WorkspaceItem field-for-field.
export interface WorkspaceItem {
  id: string;
  type: "ticket" | "chat";
  // "TCK-1234" for tickets, null for chats — a conversation has no reference
  // number, so the card falls back to its customer name.
  reference: string | null;
  title: string | null;
  priority: "low" | "medium" | "high" | "urgent" | null;
  status: string;
  customer: { id: string; name: string } | null;
  assignedAgent: { id: string; name: string } | null;
  slaStatus: "on_track" | "at_risk" | "breached";
  // The earliest defined SLA target on the item — what the column sorts on
  // and the card counts down to. Null for items predating sla-automation.
  urgencyAt: string | null;
  responseTargetAt: string | null;
  resolutionTargetAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceColumn {
  items: WorkspaceItem[];
  total: number;
}

export interface WorkspaceColumns {
  breached: WorkspaceColumn;
  at_risk: WorkspaceColumn;
  on_track: WorkspaceColumn;
}

export interface WorkspaceResponse {
  columns: WorkspaceColumns;
  generatedAt: string;
}

async function getBearerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) return token;
  return refreshSession();
}

// Used both for the page's initial server-rendered snapshot
// (dashboard/page.tsx) and for TriageBoard's client-side polling refresh —
// one action, one place that knows how to authenticate this call. Returns
// null (not an empty board) on any failure so callers can tell "no data yet"
// apart from "genuinely nothing assigned" ({ breached: { items: [], total: 0
// }, ... }). Same never-throw contract as fetchNotifications(): fetch()
// itself rejects when the backend is unreachable, and a background poll must
// degrade rather than crash the page it lives on.
export async function fetchWorkspace(): Promise<WorkspaceResponse | null> {
  const token = await getBearerToken();
  if (!token) return null;

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/me/workspace`, {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: "no-store",
    });

  try {
    let res = await doFetch(token);
    if (res.status === 401) {
      const refreshedToken = await refreshSession();
      if (!refreshedToken) return null;
      res = await doFetch(refreshedToken);
    }
    if (!res.ok) return null;
    return (await res.json()) as WorkspaceResponse;
  } catch {
    return null;
  }
}
