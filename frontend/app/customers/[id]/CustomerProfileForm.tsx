"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfile, type ProfileActionState } from "./actions";

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  preferredLanguage: "en" | "ar";
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
  const [preferredLanguage, setPreferredLanguage] = useState(profile.preferredLanguage);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("heading")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("name")}</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.name)}
              required
            />
            {state.fieldErrors?.name && <p className="text-sm text-destructive">{state.fieldErrors.name}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.email)}
              required
            />
            {state.fieldErrors?.email && <p className="text-sm text-destructive">{state.fieldErrors.email}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input id="phone" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="preferredLanguage">{t("preferredLanguage")}</Label>
            <Select
              value={preferredLanguage}
              onValueChange={(value) => setPreferredLanguage(value as "en" | "ar")}
            >
              <SelectTrigger id="preferredLanguage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("languageEnglish")}</SelectItem>
                <SelectItem value="ar">{t("languageArabic")}</SelectItem>
              </SelectContent>
            </Select>
            {/* Select doesn't submit a native form value on its own — mirror it into a hidden input. */}
            <input type="hidden" name="preferredLanguage" value={preferredLanguage} />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3">
          <Button type="submit" disabled={pending}>
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
