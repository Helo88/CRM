"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Phone, Mail } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
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

// Phone and email are two independent Server Actions (Story 5: email changes
// go through a confirm-then-apply flow, phone applies immediately) — they
// can't be merged into a single submit. Each field instead gets its own
// compact inline save affordance (icon button, enabled only once the value
// is actually dirty) rather than two full-width buttons stacked in the card.
export function SettingsForm({ contact }: { contact: ContactInfo }) {
  const t = useTranslations("Settings");
  const [phoneState, phoneAction, phonePending] = useActionState(updatePhone, INITIAL_STATE);
  const [emailState, emailAction, emailPending] = useActionState(updateEmail, INITIAL_STATE);
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [email, setEmail] = useState(contact.email);
  const phoneDirty = phone !== (contact.phone ?? "");
  const emailDirty = email !== contact.email;

  return (
    <Card className="w-full max-w-md rounded-[28px] rounded-ss-none border-none shadow-2xl shadow-black/20 ring-1 ring-foreground/10">
      <CardHeader className="items-center gap-1 pt-6 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">{t("heading")}</CardTitle>
        <CardDescription className="text-balance">{t("subheading")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form action={phoneAction} className="flex flex-col gap-2">
          <Label htmlFor="phone">{t("phone")}</Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phone"
              name="phone"
              className="ps-8 pe-9"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button
              type="submit"
              size="icon-sm"
              variant="secondary"
              aria-label={t("savePhone")}
              disabled={phonePending || !phoneDirty}
              className="absolute inset-y-0 end-1 my-auto disabled:opacity-0"
            >
              <Check />
            </Button>
          </div>
          {phoneState.error && <p className="text-sm text-destructive">{phoneState.error}</p>}
          {phoneState.message && <p className="text-sm text-muted-foreground">{phoneState.message}</p>}
        </form>

        <form action={emailAction} className="flex flex-col gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              className="ps-8 pe-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              type="submit"
              size="icon-sm"
              variant="secondary"
              aria-label={t("saveEmail")}
              disabled={emailPending || !emailDirty}
              className="absolute inset-y-0 end-1 my-auto disabled:opacity-0"
            >
              <Check />
            </Button>
          </div>
          {emailState.error && <p className="text-sm text-destructive">{emailState.error}</p>}
          {emailState.message && <p className="text-sm text-muted-foreground">{emailState.message}</p>}
          {contact.pendingEmail && (
            <p className="text-sm text-muted-foreground">{t("pendingEmail", { email: contact.pendingEmail })}</p>
          )}
        </form>
      </CardContent>
      <CardFooter className="border-t-0 bg-transparent pt-1">
        <p className="text-xs text-muted-foreground">{t("currentEmail", { email: contact.email })}</p>
      </CardFooter>
    </Card>
  );
}
