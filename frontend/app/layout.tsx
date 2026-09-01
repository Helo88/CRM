import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import { Direction } from "radix-ui";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/SiteHeader";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { localeDir, type Locale } from "@/lib/locale";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: { default: "AzmSquad Customer Service", template: "%s · AzmSquad" },
  description: "Customer service platform — live chat and ticket support.",
};

// Locale (Story 50) and theme both resolved server-side from cookies, so the
// first paint is already correct — no flash of the wrong language or theme.
// See components/UserMenu.tsx for where these actually get switched.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const dir = localeDir(locale);

  const cookieStore = await cookies();
  // Dark is the default per CLAUDE.md's design system, unless explicitly
  // switched to light.
  const theme: Theme = cookieStore.get(THEME_COOKIE)?.value === "light" ? "light" : "dark";

  return (
    <html
      lang={locale}
      dir={dir}
      className={cn(theme === "dark" && "dark", "font-sans", inter.variable)}
      // Browser extensions commonly inject their own attributes onto <html>
      // before React hydrates (the reported data-qb-installed one is exactly
      // that) — React then reports a hydration mismatch it can't actually do
      // anything about. This is Next.js's own documented remedy for that
      // case; it does NOT suppress mismatches in this element's children,
      // only attribute diffs on <html> itself.
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Direction.Provider dir={dir}>
            <SiteHeader />
            {children}
          </Direction.Provider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
