"use client";

import { useActionState } from "react";
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
  const [phoneState, phoneAction, phonePending] = useActionState(updatePhone, INITIAL_STATE);
  const [emailState, emailAction, emailPending] = useActionState(updateEmail, INITIAL_STATE);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Account settings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form action={phoneAction} className="flex flex-col gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={contact.phone ?? ""} />
          <Button type="submit" size="sm" className="self-start" disabled={phonePending}>
            Save phone
          </Button>
          {phoneState.error && <p className="text-sm text-destructive">{phoneState.error}</p>}
          {phoneState.message && <p className="text-sm text-muted-foreground">{phoneState.message}</p>}
        </form>

        <form action={emailAction} className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" defaultValue={contact.email} />
          <Button type="submit" size="sm" className="self-start" disabled={emailPending}>
            Save email
          </Button>
          {emailState.error && <p className="text-sm text-destructive">{emailState.error}</p>}
          {emailState.message && <p className="text-sm text-muted-foreground">{emailState.message}</p>}
          {contact.pendingEmail && (
            <p className="text-sm text-muted-foreground">
              Pending: <span className="font-medium">{contact.pendingEmail}</span> — awaiting confirmation.
            </p>
          )}
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">Current email: {contact.email}</p>
      </CardFooter>
    </Card>
  );
}
