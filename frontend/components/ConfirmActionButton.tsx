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
  successful?: boolean;
  onConfirm: () => Promise<{ error: string | null }>;
}

// Hoisted from frontend/app/admin/ticket-categories/ConfirmActionButton.tsx
// (sla-automation Story 25) — that file and the SLA-targets tab's copy were
// byte-identical, so this is the shared version both import instead of
// maintaining two copies. Route-local dialogs (RenameCategoryDialog-style)
// stay colocated since those carry domain-specific text; this component
// takes every string as a prop, so hoisting it duplicates nothing.
export function ConfirmActionButton({
  icon,
  label,
  triggerVariant = "ghost",
  confirmTitle,
  confirmBody,
  confirmActionLabel,
  cancelLabel,
  destructive,
  successful,
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
          className={
            destructive
              ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
              : successful
                ? "text-success hover:bg-success/10 hover:text-success"
                : undefined
          }
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
