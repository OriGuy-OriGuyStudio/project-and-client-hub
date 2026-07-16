import type { QuotePhase } from "@/lib/quote-v2";
import { QuoteSection } from "./Reveal";
import { Timeline } from "./Timeline";

/** "איך זה עובד" , the build phases as a numbered vertical timeline (shared
 *  `Timeline` component, also used by NextStepsSection). */
export function ProcessSection({ phases }: { phases: QuotePhase[] }) {
  if (!phases || phases.length === 0) return null;
  return (
    <QuoteSection id="process" title="איך זה עובד">
      <Timeline
        items={phases}
        renderItem={(p) => (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-base font-semibold text-foreground">{p.name}</p>
              {p.duration && <p className="text-xs text-muted-foreground">{p.duration}</p>}
            </div>
            {p.desc && <p className="mt-1 text-base leading-relaxed text-muted-foreground">{p.desc}</p>}
          </div>
        )}
      />
    </QuoteSection>
  );
}
