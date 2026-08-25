import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Direction } from "radix-ui";
import { cn } from "@/lib/utils";

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "AzmSquad Customer Service",
  description: "Customer service platform — live chat and ticket support.",
};

// TODO (platform feature, Story 49): read the active locale (from user settings or
// a locale cookie) and derive lang/dir from it instead of the hardcoded "en"/"ltr".
export default function RootLayout({ children }: { children: ReactNode }) {
  const dir = "ltr" as "ltr" | "rtl";
  return (
    <html lang="en" dir={dir} className={cn("font-sans", plusJakartaSans.variable)}>
      <body>
        <Direction.Provider dir={dir}>{children}</Direction.Provider>
      </body>
    </html>
  );
}
