import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StaffSidebar } from "@/components/StaffSidebar";
import { API_URL, REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { AgentChatPanel, type AgentChatMessage } from "./AgentChatPanel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AgentChats");
  return { title: t("detailMetaTitle"), robots: { index: false, follow: false } };
}

interface ConversationDetail {
  _id: string;
  status: "ai_handling" | "escalated" | "with_agent" | "resolved";
}

export default async function ChatDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ _refreshed?: string }>;
}) {
  const { id } = await params;
  const { _refreshed } = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!token) {
    if (hasRefreshToken && !_refreshed) {
      redirect(`/api/session/refresh?next=/chats/${id}`);
    }
    redirect("/");
  }

  const { id: currentUserId } = peekJwtPayload(token);

  const res = await fetch(`${API_URL}/api/v1/conversations/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) {
    if (!_refreshed) {
      redirect(`/api/session/refresh?next=/chats/${id}`);
    }
    redirect("/login");
  }
  if (res.status === 403 || res.status === 404) {
    notFound();
  }
  if (!res.ok) {
    redirect("/chats");
  }
  const data: { conversation: ConversationDetail; messages: AgentChatMessage[] } = await res.json();

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar active="chats" />
      <main className="flex min-w-0 flex-1 items-center justify-center p-4 md:p-8">
        <AgentChatPanel
          conversationId={data.conversation._id}
          initialStatus={data.conversation.status}
          initialMessages={data.messages}
          token={token}
          currentUserId={currentUserId}
        />
      </main>
    </div>
  );
}
