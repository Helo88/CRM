"use server";

import { cookies } from "next/headers";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

export type SummarizeResult =
  | { ok: true; summary: string }
  | { ok: false; reason: "not_enough_messages" | "ai_unavailable" | "forbidden" };

// ai-features Story 32 (agent live-chat half) — same shape as
// tickets/[id]/summarizeAction.ts, just the conversation endpoint.
export async function summarizeConversationAction(conversationId: string): Promise<SummarizeResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? (await refreshSession());
  if (!token) return { ok: false, reason: "forbidden" };

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/conversations/${conversationId}/summarize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}` },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) return { ok: false, reason: "forbidden" };
    res = await doFetch(refreshedToken);
  }

  if (res.status === 403) return { ok: false, reason: "forbidden" };
  if (res.status === 409) return { ok: false, reason: "not_enough_messages" };
  if (!res.ok) return { ok: false, reason: "ai_unavailable" };

  const body = (await res.json()) as { summary: string };
  return { ok: true, summary: body.summary };
}
