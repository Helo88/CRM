"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CircleAlert, Mail, Phone, User } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateProfile, type ProfileActionState } from "./actions";

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  ticketHistoryUrl: string;
}

const INITIAL_STATE: ProfileActionState = { error: null, message: null };

export function CustomerProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations("CustomerProfile");
  const updateProfileForId = updateProfile.bind(null, profile.id);
  const [state, formAction, pending] = useActionState(updateProfileForId, INITIAL_STATE);

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? "");

  return (
    <Card className="w-full max-w-md rounded-[28px] rounded-ss-none border-none shadow-2xl shadow-black/20 ring-1 ring-foreground/10">
      <CardHeader className="items-center gap-1 pt-6 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">{t("heading")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("name")}</Label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name"
                name="name"
                className="ps-8"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(state.fieldErrors?.name)}
                required
              />
            </div>
            {state.fieldErrors?.name && <p className="text-sm text-destructive">{state.fieldErrors.name}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                className="ps-8"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(state.fieldErrors?.email)}
                required
              />
            </div>
            {state.fieldErrors?.email && <p className="text-sm text-destructive">{state.fieldErrors.email}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">{t("phone")}</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="phone"
                name="phone"
                type="tel"
                className="ps-8"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={Boolean(state.fieldErrors?.phone)}
              />
            </div>
            {state.fieldErrors?.phone && <p className="text-sm text-destructive">{state.fieldErrors.phone}</p>}
          </div>
          {state.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          {state.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 border-t-0 bg-transparent pt-1">
          <Button type="submit" disabled={pending} className="transition-transform active:scale-[0.98]">
            {pending ? t("savePending") : t("save")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("createdAt", { date: new Date(profile.createdAt).toLocaleDateString() })}
          </p>
          <Link href={profile.ticketHistoryUrl} className="text-sm text-primary underline-offset-4 hover:underline">
            {t("viewHistory")}
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
