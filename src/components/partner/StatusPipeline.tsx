import { cn } from "@/lib/utils";

// The shared funnel for both partner leads and client referrals (same status keys
// after the lifecycle unification). Shown as a mini progress bar so the referrer
// always sees where things stand.
export const PIPELINE_STAGES: { key: string; label: string }[] = [
  { key: "submitted", label: "התקבל" },
  { key: "awaiting_intro", label: "ממתין לשיחה" },
  { key: "intro_done", label: "שיחה בוצעה" },
  { key: "quote_sent", label: "הצעה נשלחה" },
  { key: "client_approved", label: "לקוח אישר" },
  { key: "closed", label: "אושר לעבודה" },
];

/** Renders the funnel progress for a given status. On mobile it's a compact bar
 *  with a single "current stage" line; on desktop every stage is labeled. A
 *  dropped (not_relevant) item shows a distinct "fell through" state. */
export function StatusPipeline({ status }: { status: string }) {
  if (status === "not_relevant") {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
        <span className="size-1.5 rounded-full bg-destructive" />
        נפל / לא רלוונטי
      </p>
    );
  }
  const total = PIPELINE_STAGES.length;
  const current = Math.max(0, PIPELINE_STAGES.findIndex((s) => s.key === status));

  return (
    <div className="space-y-1.5">
      {/* Segment bar — always visible */}
      <div className="flex items-center gap-1.5">
        {PIPELINE_STAGES.map((s, i) => (
          <div
            key={s.key}
            className={cn("h-1.5 flex-1 rounded-full", i <= current ? "bg-primary" : "bg-border")}
          />
        ))}
      </div>

      {/* Mobile: one readable line for the current stage */}
      <p className="text-xs sm:hidden">
        <span className="font-semibold text-primary">{PIPELINE_STAGES[current].label}</span>
        <span className="text-muted-foreground"> · שלב {current + 1} מתוך {total}</span>
      </p>

      {/* Desktop: a label under every segment */}
      <div className="hidden items-start gap-1.5 sm:flex">
        {PIPELINE_STAGES.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              "flex-1 text-center text-[10px] leading-tight",
              i === current ? "font-semibold text-primary" : "text-muted-foreground"
            )}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
