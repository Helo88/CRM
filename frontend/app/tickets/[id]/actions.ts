"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

export interface TicketDetailActionState {
  error: string | null;
}

async function getBearerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) return token;
  return refreshSession();
}

async function patchTicket(
  ticketId: string,
  body: { category: string | null } | { priority: string } | { assignedAgent: string | null }
): Promise<TicketDetailActionState> {
  const t = await getTranslations("TicketDetail");
  const token = await getBearerToken();
  if (!token) {
    return { error: t("changeFailed") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(body),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { error: t("changeFailed") };
    }
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    if (res.status === 403) return { error: t("noAccess") };
    return { error: t("changeFailed") };
  }

  revalidatePath(`/tickets/${ticketId}`);
  return { error: null };
}

export async function updateTicketCategory(
  ticketId: string,
  category: string | null
): Promise<TicketDetailActionState> {
  return patchTicket(ticketId, { category });
}

export async function updateTicketPriority(ticketId: string, priority: string): Promise<TicketDetailActionState> {
  return patchTicket(ticketId, { priority });
}

export async function reassignTicket(
  ticketId: string,
  assignedAgent: string | null
): Promise<TicketDetailActionState> {
  return patchTicket(ticketId, { assignedAgent });
}

export interface AssignableAgent {
  id: string;
  name: string;
  isOnline: boolean;
}

// Story 25: backs both the ticket-detail sidebar's "Assigned agent" select
// and the queue table's reassign dropdown — one shared action, mirroring
// listActiveTicketCategories in ../new/actions.ts. Returns [] on any
// failure (signed out, forbidden, network hiccup) — same "degrade to
// empty" reasoning that function already uses.
export async function listAssignableAgents(): Promise<AssignableAgent[]> {
  const token = await getBearerToken();
  if (!token) return [];

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/tickets/assignable-agents`, {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: "no-store",
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) return [];
    res = await doFetch(refreshedToken);
  }
  if (!res.ok) return [];
  return (await res.json()) as AssignableAgent[];
}

export interface SendTicketReplyState {
  error: string | null;
}

// Forwards a multipart FormData (text + optional files) straight through,
// never touching Content-Type (fetch sets the multipart boundary itself) —
// same shape as customers/[id]/actions.ts's doMultipartRequest.
export async function sendTicketReply(ticketId: string, formData: FormData): Promise<SendTicketReplyState> {
  const t = await getTranslations("TicketDetail");
  const token = await getBearerToken();
  if (!token) {
    return { error: t("changeFailed") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}` },
      body: formData,
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { error: t("changeFailed") };
    }
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    if (res.status === 403) return { error: t("noAccess") };
    const data = await res.json().catch(() => null);
    if (data?.error === "UNSUPPORTED_FILE_TYPE") return { error: t("unsupportedFileType") };
    if (res.status === 413) return { error: t("fileTooLarge") };
    return { error: t("changeFailed") };
  }

  revalidatePath(`/tickets/${ticketId}`);
  return { error: null };
}
