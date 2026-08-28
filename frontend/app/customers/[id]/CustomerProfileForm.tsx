"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CircleAlert, Mail, Phone, User, ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StepIndicator } from "@/components/StepIndicator";
import { InternalStep, type HydratedAttachment, type HydratedNote } from "./InternalStep";
import { AttachmentsGalleryStep } from "./AttachmentsGalleryStep";
import { updateProfile, type ProfileActionState } from "./actions";

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  ticketHistoryUrl: string;
  // Present only for a full-staff viewer (Story 7) — absence, not an empty
  // array, is what tells this component to render the read-only gallery
  // instead of the staff "Internal" step. Never derived from role client-side.
  internalNotes?: HydratedNote[];
  attachments?: HydratedAttachment[];
  idDocument?: HydratedAttachment | null;
}

const INITIAL_STATE: ProfileActionState = { error: null, message: null };

// Two-step stepper for every viewer (Story 7) — Step 1 is this same profile
// form Story 4 already had; Step 2's content depends entirely on whether the
// backend included internalNotes, never a client-side role check (see the
// Profile interface's comment above).
export function CustomerProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations("CustomerProfile");
  const updateProfileForId = updateProfile.bind(null, profile.id);
  const [state, formAction, pending] = useActionState(updateProfileForId, INITIAL_STATE);
  const [step, setStep] = useState<0 | 1>(0);

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? "");

  const isStaffMode = profile.internalNotes !== undefined;
  const steps = [
    { key: "profile", label: t("stepProfile") },
    { key: "step2", label: isStaffMode ? t("stepInternal") : t("stepDocuments") },
  ];

  return (
    <Card className="w-full max-w-lg rounded-[28px] rounded-ss-none border-none shadow-pop ring-1 ring-foreground/10">
      <CardHeader className="items-center gap-1 pt-6 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">{t("heading")}</CardTitle>
        <div className="w-full pt-4">
          <StepIndicator steps={steps} currentIndex={step} />
        </div>
      </CardHeader>

      <div className={step === 0 ? "" : "hidden"}>
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
      </div>

      <div className={step === 1 ? "" : "hidden"}>
        {isStaffMode ? (
          <InternalStep
            customerId={profile.id}
            notes={profile.internalNotes ?? []}
            attachments={profile.attachments ?? []}
            idDocument={profile.idDocument ?? null}
          />
        ) : (
          <AttachmentsGalleryStep
            customerId={profile.id}
            attachments={profile.attachments ?? []}
            idDocument={profile.idDocument ?? null}
          />
        )}
      </div>

      <CardFooter className="flex gap-2 border-t-0 bg-transparent pt-1">
        {step === 1 && (
          <Button type="button" variant="outline" onClick={() => setStep(0)}>
            <ArrowLeft className="size-4 rtl:-scale-x-100" />
            {t("back")}
          </Button>
        )}
        {step === 0 && (
          <Button type="button" variant="outline" className="ms-auto" onClick={() => setStep(1)}>
            {t(isStaffMode ? "stepInternal" : "stepDocuments")}
            <ArrowRight className="size-4 rtl:-scale-x-100" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
