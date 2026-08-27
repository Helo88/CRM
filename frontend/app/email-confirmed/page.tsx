import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { CircleCheck, CircleX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("EmailConfirmed");
  return { title: t("successHeading"), robots: { index: false, follow: false } };
}

// Public page — the link in the confirmation email (me.routes.ts's
// GET /email/confirm) redirects here rather than to /settings directly,
// because whoever clicks it may not be authenticated in that browser at all
// (e.g. opening the email on their phone). Reads cookies only to pick a
// sensible next-step link, never to gate the page itself.
export default async function EmailConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; email?: string }>;
}) {
  const { status, email } = await searchParams;
  const t = await getTranslations("EmailConfirmed");
  const cookieStore = await cookies();
  const isSignedIn = Boolean(
    cookieStore.get(SESSION_COOKIE)?.value || cookieStore.get(REFRESH_COOKIE)?.value
  );
  const nextHref = isSignedIn ? "/settings" : "/login";
  const nextLabel = isSignedIn ? t("goToSettings") : t("logIn");

  const isSuccess = status === "success";
  const heading = isSuccess
    ? t("successHeading")
    : status === "conflict"
      ? t("conflictHeading")
      : t("invalidHeading");
  const body = isSuccess
    ? t("successBody", { email: email ?? "" })
    : status === "conflict"
      ? t("conflictBody")
      : t("invalidBody");

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Card className="w-full max-w-md rounded-[28px] rounded-ss-none border-none shadow-2xl shadow-black/20 ring-1 ring-foreground/10">
        <CardHeader className="items-center gap-3 pt-6 text-center">
          {isSuccess ? (
            <CircleCheck className="size-10 text-success" />
          ) : (
            <CircleX className="size-10 text-destructive" />
          )}
          <div className="flex flex-col gap-1">
            <CardTitle className="text-2xl font-bold tracking-tight">{heading}</CardTitle>
            <CardDescription className="text-balance">{body}</CardDescription>
          </div>
        </CardHeader>
        <CardContent />
        <CardFooter className="flex flex-col items-stretch border-t-0 bg-transparent pt-1">
          <Button asChild className="transition-transform active:scale-[0.98]">
            <Link href={nextHref}>{nextLabel}</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
