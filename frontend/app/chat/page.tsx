import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { LiveChatPanel } from "./LiveChatPanel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Chat");
  return { title: t("heading") };
}

// Story 14: customer-only live-chat surface, reached from /support's "Start
// chat" CTA (frontend/app/support/page.tsx). Auth gating mirrors that same
// page: cookie → access-token presence → silent-refresh redirect → role
// check. Staff never open the customer chat widget — they get their own
// reply UI in Story 18.
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ _refreshed?: string }>;
}) {
  const { _refreshed } = await searchParams;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!accessToken) {
    if (hasRefreshToken && !_refreshed) {
      redirect("/api/session/refresh?next=/chat");
    }
    redirect("/");
  }

  const { role } = peekJwtPayload(accessToken);
  if (role !== "customer") {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center p-4 md:p-8">
      <LiveChatPanel token={accessToken} />
    </main>
  );
}
