import type { QuotePhase } from "@/lib/quote-v2";
import { QuoteSection } from "./Reveal";
import { Timeline } from "./Timeline";

/** "איך זה עובד" , the build phases as a numbered vertical timeline (shared
 *  `Timeline` component, also used by NextStepsSection). */
export function ProcessSection({ phases }: { phases: QuotePhase[] }) {
  if (!phases || phases.length === 0) return null;
  return (
    <QuoteSection id="process" title="מהחתימה ועד ההשקה">
      {/* mx-auto max-w-xl matches NextStepsSection's own wrapper , the two
         numbered-timeline sections on the page must read as one centered
         block, not one centered and one full-width (Ori: "חלק ממורכז חלק
         לא"). */}
      <div className="mx-auto max-w-xl">
        <Timeline
          items={phases}
          renderItem={(p) => (
            <div className="pt-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="text-lg font-semibold text-foreground">{p.name}</p>
                {p.duration && (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {p.duration}
                  </span>
                )}
              </div>
              {p.desc && <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">{p.desc}</p>}
            </div>
          )}
        />
      </div>
    </QuoteSection>
  );
}
