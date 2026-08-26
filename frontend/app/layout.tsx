import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Direction } from "radix-ui";
import { NextIntlClientProvider } from "next-intl";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/SiteHeader";

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "AzmSquad Customer Service", template: "%s · AzmSquad" },
  description: "Customer service platform — live chat and ticket support.",
};

// TODO (platform feature, Story 49): read the active locale (from user settings or
// a locale cookie) and derive lang/dir from it instead of the hardcoded "en"/"ltr".
export default function RootLayout({ children }: { children: ReactNode }) {
  const dir = "ltr" as "ltr" | "rtl";
  return (
    <html lang="en" dir={dir} className={cn("dark font-sans", plusJakartaSans.variable)}>
      <body>
        <NextIntlClientProvider>
          <Direction.Provider dir={dir}>
            <SiteHeader />
            {children}
          </Direction.Provider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
