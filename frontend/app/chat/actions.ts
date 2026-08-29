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
