import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MessageCircle, Ticket } from "lucide-react";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Support");
  return { title: t("meta.title"), description: t("meta.description") };
}

// Customer-only entry point (Story 53): one page that chooses between the
// two support channels, so nobody has to guess which nav link gets them
// help. Auth pattern mirrors settings/page.tsx exactly — a Server Component
// can't refresh its own session, so a missing access token goes through the
// silent-refresh redirect first, not straight to a dead end.
export default async function SupportPage({
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
      redirect("/api/session/refresh?next=/support");
    }
    redirect("/");
  }

  const { role } = peekJwtPayload(accessToken);
  const isStaff = role === "agent" || role === "admin" || role === "subadmin";
  if (isStaff) {
    redirect("/dashboard");
  }

  const t = await getTranslations("Support");

  return (
    <main className="min-h-[calc(100vh-57px)] p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 py-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">{t("heading")}</h1>
          <p className="text-balance text-muted-foreground">{t("intro")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <MessageCircle className="size-6 text-primary" aria-hidden="true" />
              <CardTitle>{t("liveChat.title")}</CardTitle>
              <CardDescription>{t("liveChat.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/chat">{t("liveChat.cta")}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Ticket className="size-6 text-primary" aria-hidden="true" />
              <CardTitle>{t("ticket.title")}</CardTitle>
              <CardDescription>{t("ticket.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/tickets/new">{t("ticket.cta")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
