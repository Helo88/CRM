"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createTicketCategoryAction, type TicketCategoryActionState } from "../actions";

const INITIAL_STATE: TicketCategoryActionState = { error: null };

export function NewTicketCategoryForm() {
  const t = useTranslations("NewTicketCategory");
  const [state, formAction, pending] = useActionState(createTicketCategoryAction, INITIAL_STATE);
  // Controlled input — see LoginForm.tsx for why (CLAUDE.md, "Forms backed
  // by Server Actions").
  const [name, setName] = useState("");

  return (
    <Card className="w-full max-w-md rounded-[28px] rounded-ss-none border-none shadow-pop ring-1 ring-foreground/10">
      <CardHeader className="items-center gap-1 pt-6 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">{t("heading")}</CardTitle>
        <CardDescription className="text-balance">{t("subheading")}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("name")}</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(state.error)}
              maxLength={100}
              required
            />
          </div>
          {state.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-2 border-t-0 bg-transparent pt-1">
          <Button type="submit" disabled={pending} className="w-full transition-transform active:scale-[0.98]">
            {pending ? t("submitPending") : t("submit")}
          </Button>
          <Link href="/admin/ticket-categories" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            {t("cancel")}
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
