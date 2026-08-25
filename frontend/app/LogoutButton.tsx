"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const t = useTranslations("Auth");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={handleLogout}>
      {t("logOut")}
    </Button>
  );
}
