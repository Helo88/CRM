"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { VariantProps } from "class-variance-authority";

interface ConfirmActionButtonProps {
  icon: ReactNode;
  label: string;
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  confirmTitle: string;
  confirmBody: string;
  confirmActionLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<{ error: string | null }>;
}

// Shared confirm-dialog-wrapped icon action — used by the roster's Actions
// column for activate/deactivate and delete (security-admin Story 45
// addendum: "detailed" per-row actions, not a single blanket deactivate).
export function ConfirmActionButton({
  icon,
  label,
  triggerVariant = "outline",
  confirmTitle,
  confirmBody,
  confirmActionLabel,
  cancelLabel,
  destructive,
  onConfirm,
}: ConfirmActionButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant={triggerVariant}
          size="icon-sm"
          title={label}
          aria-label={label}
          className={destructive ? "text-destructive hover:text-destructive" : undefined}
        >
          {icon}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{error ?? confirmBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault(); // keep the dialog open until we know the outcome
              startTransition(async () => {
                const result = await onConfirm();
                if (result.error) {
                  setError(result.error);
                } else {
                  setOpen(false);
                }
              });
            }}
          >
            {confirmActionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
