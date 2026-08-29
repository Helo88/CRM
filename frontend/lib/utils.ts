import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Shared date+time formatting for "Updated"/"Last updated" table columns
// (ticket-management Story 60's queue/list, and any later list view that
// needs the same column) — date alone hides same-day ordering, which matters
// once several tickets update within one day.
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}
