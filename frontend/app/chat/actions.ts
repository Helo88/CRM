"use server";

import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

export type CreateConversationResult = { id: string; error: null } | { id: null; error: string };

// Story 14: creates the Conversation the chat panel joins over Socket.io.
// Same 401-retry shape as every other action in this app (e.g.
// frontend/app/tickets/new/actions.ts's submitTicket).
export async function createConversation(): Promise<CreateConversationResult> {
  const t = await getTranslations("Chat");
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { id: null, error: t("notSignedIn") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: "{}",
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { id: null, error: t("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    return { id: null, error: t("error") };
  }

  const data = await res.json();
  return { id: data.conversation._id, error: null };
}

export interface ChatTicketSummary {
  id: string;
  reference: string;
  subject: string;
  status: "new" | "in_progress" | "answered" | "escalated" | "closed";
  updatedAt: string;
}

export type RecentTicketsResult = { tickets: ChatTicketSummary[]; error: null } | { tickets: null; error: string };

// Chat quick-action "Previous tickets" — reuses ticket-management Story 60's
// customer-scoped GET /api/v1/tickets (already returns only the caller's own
// tickets, newest-updated-first) rather than a new endpoint. Same
// 401-retry shape as createConversation above.
export async function getMyRecentTickets(): Promise<RecentTicketsResult> {
  const t = await getTranslations("Chat");
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { tickets: null, error: t("notSignedIn") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/tickets?limit=5&sort=-updatedAt`, {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: "no-store",
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { tickets: null, error: t("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    return { tickets: null, error: t("error") };
  }

  const data: { tickets: ChatTicketSummary[] } = await res.json();
  return { tickets: data.tickets, error: null };
}

export type CreateTicketFromConversationResult =
  | { ok: true; ticketId: string; reference: string }
  | { ok: false; error: string };

// Story 62: accepting the AI's "open a ticket" suggestion. Deliberately a
// structured call, not useActionState/FormData-shaped — this is a chat-panel
// action, not a page-level form (see frontend/app/tickets/new/actions.ts's
// submitTicket for that shape instead).
export async function createTicketFromConversation({
  conversationId,
  subject,
  description,
  category,
}: {
  conversationId: string;
  subject: string;
  description: string;
  category: string;
}): Promise<CreateTicketFromConversationResult> {
  const t = await getTranslations("Chat");
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { ok: false, error: t("notSignedIn") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ subject, description, category, sourceConversation: conversationId }),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { ok: false, error: t("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    return { ok: false, error: t("suggestionCreateFailed") };
  }

  const data = await res.json();
  return { ok: true, ticketId: data.id, reference: data.reference };
}
