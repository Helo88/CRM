"use client";

import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Standalone header icon button — pulled out of UserMenu's dropdown so
// theme switching is a single click, matching the reference header's
// separate theme control. Same cookie-write + router.refresh pattern.
export function ThemeToggleButton({ theme }: { theme: Theme }) {
  const router = useRouter();
  const t = useTranslations("Nav");

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-xl border-border bg-card shadow-soft"
      onClick={toggle}
      aria-label={t("toggleTheme")}
    >
      {theme === "dark" ? <Sun className="size-[17px]" /> : <Moon className="size-[17px]" />}
    </Button>
  );
}
