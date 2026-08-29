import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  key: string;
  label: string;
}

type StepStatus = "complete" | "current" | "upcoming";

function statusOf(index: number, currentIndex: number): StepStatus {
  if (index < currentIndex) return "complete";
  if (index === currentIndex) return "current";
  return "upcoming";
}

function StepCircle({ status, number }: { status: StepStatus; number: number }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition-colors",
        status === "complete" && "border-success bg-success text-success-foreground",
        status === "current" && "border-primary bg-primary text-primary-foreground shadow-soft",
        status === "upcoming" && "border-border bg-muted text-muted-foreground"
      )}
    >
      {status === "complete" ? <Check className="size-4" /> : number}
    </span>
  );
}

// Numbered checkmark stepper — horizontal row on desktop, vertical stack on
// mobile. Two separate markup blocks (toggled by breakpoint) rather than one
// flex-direction-switching layout, since the connector line's orientation
// and the label's position relative to the circle both flip, not just the
// axis.
export function StepIndicator({ steps, currentIndex }: { steps: Step[]; currentIndex: number }) {
  return (
    <>
      <ol className="mx-auto hidden w-full max-w-xs items-start sm:flex" aria-label="Progress">
        {steps.map((step, index) => {
          const status = statusOf(index, currentIndex);
          const isLast = index === steps.length - 1;
          return (
            <li key={step.key} className={cn("flex items-center", !isLast && "flex-1")} aria-current={status === "current" ? "step" : undefined}>
              <div className="flex flex-col items-center gap-2">
                <StepCircle status={status} number={index + 1} />
                <span
                  className={cn(
                    "text-xs font-semibold whitespace-nowrap",
                    status === "upcoming" ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <span
                  className={cn(
                    "mx-3 mb-5 h-0.5 flex-1 rounded-full transition-colors",
                    status === "complete" ? "bg-success" : "bg-border"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      <ol className="flex flex-col sm:hidden" aria-label="Progress">
        {steps.map((step, index) => {
          const status = statusOf(index, currentIndex);
          const isLast = index === steps.length - 1;
          return (
            <li key={step.key} className="flex gap-3" aria-current={status === "current" ? "step" : undefined}>
              <div className="flex flex-col items-center">
                <StepCircle status={status} number={index + 1} />
                {!isLast && (
                  <span
                    className={cn(
                      "my-1 w-0.5 flex-1 rounded-full transition-colors",
                      status === "complete" ? "bg-success" : "bg-border"
                    )}
                  />
                )}
              </div>
              <div
                className={cn(
                  "pb-6 text-sm font-semibold",
                  status === "upcoming" ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {step.label}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
