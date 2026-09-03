"use server";

import { cookies } from "next/headers";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

// ai-features Story 32: shared by frontend/components/SummaryPanel.tsx's
// useSummarize hook, which is called directly from both
// frontend/app/tickets/[id]/TicketSummaryPanel.tsx and
// frontend/app/chats/[id]/AgentChatPanel.tsx — previously each had its own
// summarizeAction.ts duplicating this whole token-read/refresh-retry/
// status-mapping dance byte-for-byte (see the code review of commit
// 3c96c60; both files were deleted in favor of this one). Unlike
// lib/session.ts's refreshSession (a plain helper only ever called from
// inside another "use server" file), this file needs its own "use server"
// directive: SummaryPanel.tsx is a Client Component that imports and calls
// summarizeResource directly, so this whole module must be a real Server
// Action boundary or Next.js tries to bundle next/headers into client code.
export type SummarizeResult =
  | { ok: true; summary: string }
  | { ok: false; reason: "not_enough_messages" | "not_found" | "ai_unavailable" | "forbidden" };

export async function summarizeResource(
  kind: "tickets" | "conversations",
  id: string
): Promise<SummarizeResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? (await refreshSession());
  if (!token) return { ok: false, reason: "forbidden" };

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/${kind}/${id}/summarize`, {
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
  if (res.status === 404) return { ok: false, reason: "not_found" };
  if (res.status === 409) return { ok: false, reason: "not_enough_messages" };
  if (!res.ok) return { ok: false, reason: "ai_unavailable" };

  const body = (await res.json()) as { summary: string };
  return { ok: true, summary: body.summary };
}
