"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function RegisterForm() {
  const router = useRouter();
  const t = useTranslations("Register");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? t("genericError"));
      setPending(false);
      return;
    }

    router.push("/settings");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("heading")}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? t("submitPending") : t("submit")}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            {t("haveAccount")}{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              {t("logIn")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
