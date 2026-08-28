"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LOCALE_COOKIE, type Locale } from "@/lib/locale";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Standalone header icon button — same role as ThemeToggleButton, for pages
// (e.g. signed-out nav) where there's no UserMenu dropdown to hold the
// locale switch.
export function LocaleToggleButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  const t = useTranslations("Nav");

  function toggle() {
    const next: Locale = locale === "en" ? "ar" : "en";
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-xl border-border bg-card shadow-soft"
      onClick={toggle}
      aria-label={t("toggleLanguage")}
    >
      <Languages className="size-[17px]" />
    </Button>
  );
}
