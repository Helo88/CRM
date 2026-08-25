"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updatePhone, updateEmail, type ContactActionState } from "./actions";

interface ContactInfo {
  phone: string | null;
  email: string;
  pendingEmail: string | null;
}

const INITIAL_STATE: ContactActionState = { error: null, message: null };

export function SettingsForm({ contact }: { contact: ContactInfo }) {
  const t = useTranslations("Settings");
  const [phoneState, phoneAction, phonePending] = useActionState(updatePhone, INITIAL_STATE);
  const [emailState, emailAction, emailPending] = useActionState(updateEmail, INITIAL_STATE);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("heading")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form action={phoneAction} className="flex flex-col gap-2">
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input id="phone" name="phone" defaultValue={contact.phone ?? ""} />
          <Button type="submit" size="sm" className="self-start" disabled={phonePending}>
            {t("savePhone")}
          </Button>
          {phoneState.error && <p className="text-sm text-destructive">{phoneState.error}</p>}
          {phoneState.message && <p className="text-sm text-muted-foreground">{phoneState.message}</p>}
        </form>

        <form action={emailAction} className="flex flex-col gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" defaultValue={contact.email} />
          <Button type="submit" size="sm" className="self-start" disabled={emailPending}>
            {t("saveEmail")}
          </Button>
          {emailState.error && <p className="text-sm text-destructive">{emailState.error}</p>}
          {emailState.message && <p className="text-sm text-muted-foreground">{emailState.message}</p>}
          {contact.pendingEmail && (
            <p className="text-sm text-muted-foreground">{t("pendingEmail", { email: contact.pendingEmail })}</p>
          )}
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">{t("currentEmail", { email: contact.email })}</p>
      </CardFooter>
    </Card>
  );
}
