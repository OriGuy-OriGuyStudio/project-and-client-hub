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

/** Renders the funnel progress for a given status; a dropped (not_relevant) item
 *  shows a distinct "fell through" state instead of the bar. */
export function StatusPipeline({ status }: { status: string }) {
  if (status === "not_relevant") {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
        <span className="size-1.5 rounded-full bg-destructive" />
        נפל / לא רלוונטי
      </p>
    );
  }
  const current = Math.max(0, PIPELINE_STAGES.findIndex((s) => s.key === status));
  return (
    <div className="flex items-end gap-1.5">
      {PIPELINE_STAGES.map((s, i) => {
        const done = i <= current;
        return (
          <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={cn(
                "text-[10px] leading-tight",
                i === current ? "font-semibold text-primary" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
            <div className={cn("h-1.5 w-full rounded-full", done ? "bg-primary" : "bg-border")} />
          </div>
        );
      })}
    </div>
  );
}
