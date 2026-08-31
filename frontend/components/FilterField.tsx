import { cn } from "@/lib/utils";

// Shared by every list view's filter bar (TicketFilterBar, CustomerFilterBar,
// AdminUsersFilterBar) — labeled wrapper around a single filter control.
export function FilterField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex w-full flex-col gap-1 sm:w-auto", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
