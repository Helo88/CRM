"use client";

import { useActionState, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CircleAlert, CircleCheck, ChevronsUpDown, Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  submitTicket,
  listCustomersForPicker,
  type SubmitTicketActionState,
  type CustomerOption,
} from "./actions";

const INITIAL_STATE: SubmitTicketActionState = { error: null };
type Priority = "low" | "medium" | "high" | "urgent";

export function SubmitTicketForm({ mode }: { mode: "customer" | "staff" }) {
  const t = useTranslations("NewTicket");
  const [state, formAction, pending] = useActionState(submitTicket, INITIAL_STATE);
  // Controlled inputs — see LoginForm.tsx for why (CLAUDE.md, "Forms backed
  // by Server Actions").
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  // Staff-mode-only state (Story 57).
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customersForbidden, setCustomersForbidden] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(mode === "staff");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [notifyCustomer, setNotifyCustomer] = useState(false);

  useEffect(() => {
    if (mode !== "staff") return;
    let cancelled = false;
    listCustomersForPicker().then((result) => {
      if (cancelled) return;
      setCustomers(result.customers);
      setCustomersForbidden(result.forbidden);
      setCustomersLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  if (state.referenceNumber) {
    return (
      <Card className="w-full max-w-md rounded-[28px] rounded-ss-none border-none shadow-pop ring-1 ring-foreground/10">
        <CardHeader className="items-center gap-2 pt-6 text-center">
          <CircleCheck className="size-10 text-success" />
          <CardTitle className="text-2xl font-bold tracking-tight">{t("confirmedHeading")}</CardTitle>
          <CardDescription className="text-balance">
            {mode === "staff" ? t("staffConfirmedBody") : t("confirmedBody")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-1 pb-6 text-center">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("referenceLabel")}</span>
          <span className="font-mono text-sm">{state.referenceNumber}</span>
        </CardContent>
        <CardFooter className="justify-center border-t-0 bg-transparent pt-1">
          <Link href="/support" className="text-sm text-primary underline-offset-4 hover:underline">
            {t("backToSupport")}
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md rounded-[28px] rounded-ss-none border-none shadow-pop ring-1 ring-foreground/10">
      <CardHeader className="items-center gap-1 pt-6 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">
          {t(mode === "staff" ? "staffHeading" : "heading")}
        </CardTitle>
        <CardDescription className="text-balance">
          {t(mode === "staff" ? "staffSubheading" : "subheading")}
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="mode" value={mode} />
        <CardContent className="flex flex-col gap-5">
          {mode === "staff" && (
            <div className="flex flex-col gap-2">
              <Label>{t("pickCustomer")}</Label>
              <input type="hidden" name="customerId" value={selectedCustomer?.id ?? ""} />
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={pickerOpen}
                    aria-invalid={Boolean(state.fieldErrors?.customerId)}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {selectedCustomer
                        ? `${selectedCustomer.name} — ${selectedCustomer.email}`
                        : t("pickCustomerPlaceholder")}
                    </span>
                    <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0">
                  <Command>
                    <CommandInput placeholder={t("pickCustomerPlaceholder")} />
                    <CommandList>
                      {customersForbidden ? (
                        <div className="p-3 text-sm text-muted-foreground">{t("askAdminForCustomersManage")}</div>
                      ) : (
                        <>
                          <CommandEmpty>
                            {customersLoading ? "…" : t("noCustomersFound")}
                          </CommandEmpty>
                          <CommandGroup>
                            {customers.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.name} ${c.email}`}
                                onSelect={() => {
                                  setSelectedCustomer(c);
                                  setPickerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "me-2 size-4",
                                    selectedCustomer?.id === c.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="flex flex-col overflow-hidden">
                                  <span className="truncate">{c.name}</span>
                                  <span className="truncate text-xs text-muted-foreground">{c.email}</span>
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {state.fieldErrors?.customerId && (
                <p className="text-sm text-destructive">{state.fieldErrors.customerId}</p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="subject">{t("subject")}</Label>
            <Input
              id="subject"
              name="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.subject)}
              maxLength={200}
              required
            />
            {state.fieldErrors?.subject && <p className="text-sm text-destructive">{state.fieldErrors.subject}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              name="description"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.description)}
              maxLength={4000}
              required
            />
            {state.fieldErrors?.description && (
              <p className="text-sm text-destructive">{state.fieldErrors.description}</p>
            )}
          </div>
          {mode === "staff" && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="category">{t("category")}</Label>
                <Input
                  id="category"
                  name="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">{t("categoryHint")}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="priority">{t("priority")}</Label>
                <Select name="priority" value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger id="priority" className="w-full" aria-invalid={Boolean(state.fieldErrors?.priority)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t("priorityLow")}</SelectItem>
                    <SelectItem value="medium">{t("priorityMedium")}</SelectItem>
                    <SelectItem value="high">{t("priorityHigh")}</SelectItem>
                    <SelectItem value="urgent">{t("priorityUrgent")}</SelectItem>
                  </SelectContent>
                </Select>
                {state.fieldErrors?.priority && (
                  <p className="text-sm text-destructive">{state.fieldErrors.priority}</p>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="notifyCustomer" className="font-normal">
                    {t("notifyCustomer")}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("notifyCustomerHint")}</p>
                </div>
                <input type="hidden" name="notifyCustomer" value={notifyCustomer ? "true" : "false"} />
                <Switch id="notifyCustomer" checked={notifyCustomer} onCheckedChange={setNotifyCustomer} />
              </div>
            </>
          )}
          {state.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="border-t-0 bg-transparent pt-1">
          <Button type="submit" disabled={pending} className="w-full transition-transform active:scale-[0.98]">
            {pending ? t("submitPending") : t("submit")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
