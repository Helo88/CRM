import type { ReactNode } from "react";

// Not decoration: this product's own User model tracks isOnline for agents.
// Surfacing that same idea — someone is actually here — as the auth pages'
// focal signature, in place of a generic icon badge or gradient accent.
export function PresenceBadge({ label }: { label: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-success opacity-75 [animation-duration:2.5s]" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}
