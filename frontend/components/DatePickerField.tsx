"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

// Shared by every date-range filter (NotificationDateFilter, TicketFilterBar)
// — a themed Calendar popover instead of a native <input type="date">. The
// native control's own picker is unstyleable browser/OS chrome that ignores
// dark mode entirely (a plain white calendar popup); this Calendar component
// already carries the app's tokens and RTL chevron-flipping, so it follows
// theme and layout direction for free. Month/day names stay English-only
// for now regardless of locale — Calendar takes a react-day-picker `locale`
// (from date-fns/locale) to localize those, deliberately not wired up yet.
export function DatePickerField({
  id,
  label,
  placeholder = "—",
  value,
  minDate,
  maxDate,
  onChange,
  className,
}: {
  id: string;
  // Omit when this field is nested inside a FilterField that already
  // renders its own outer label (e.g. two DatePickerFields sharing one
  // "Created" FilterField) — an empty Label would still take up a row.
  label?: string;
  // Shown on the trigger button when no date is picked yet. Matters most
  // when two of these sit side by side with no other text between them
  // (TicketFilterBar's Created/Updated pairs) — "—" on both looked
  // identical with nothing distinguishing "from" from "to".
  placeholder?: string;
  value: Date | undefined;
  minDate?: Date;
  maxDate?: Date;
  onChange: (value: Date | undefined) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-1 sm:w-36", className)}>
      {label && (
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            size="sm"
            className={cn("w-full min-w-0 justify-start gap-2", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="size-3.5 shrink-0" />
            <span className="truncate">{value ? format(value, "MMM d, yyyy") : placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            disabled={(date) => (minDate ? date < minDate : false) || (maxDate ? date > maxDate : false)}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
