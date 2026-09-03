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

// agent-workspace Story 35: the triage board's SLA indicator needs a signed
// RELATIVE delta ("38m" overdue / "2h 15m" remaining), which formatDateTime's
// absolute timestamp can't express. Returns the magnitude plus an `overdue`
// flag rather than a pre-signed string, so the caller picks the i18n key
// (triage.overdueBy / triage.timeLeft) and the color — the arithmetic never
// belongs inline in JSX. Minute granularity: the board polls once a minute,
// so anything finer would render a number that is already stale.
export function formatSlaDelta(targetIso: string, now: Date = new Date()): { text: string; overdue: boolean } {
  const diffMs = new Date(targetIso).getTime() - now.getTime()
  const overdue = diffMs < 0
  const totalMinutes = Math.floor(Math.abs(diffMs) / 60_000)

  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return { text: hours > 0 ? `${days}d ${hours}h` : `${days}d`, overdue }
  if (hours > 0) return { text: minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`, overdue }
  return { text: `${minutes}m`, overdue }
}
