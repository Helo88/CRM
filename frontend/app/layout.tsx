import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AzmSquad Customer Service",
  description: "Customer service platform — live chat and ticket support.",
};

// TODO (platform feature, Story 49): read the active locale (from user settings or
// a locale cookie) and set lang / dir here instead of the hardcoded "en" / "ltr".
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
