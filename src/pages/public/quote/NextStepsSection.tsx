import type { QuoteStep } from "@/lib/quote-v2";
import { QuoteSection } from "./Reveal";
import { Timeline } from "./Timeline";

/** "השלבים הבאים" , what happens right after signing, as the same numbered
 *  vertical timeline as ProcessSection (shared `Timeline` component): step
 *  title + optional desc line (bare titles read empty, per Ori). */
export function NextStepsSection({ steps }: { steps: QuoteStep[] }) {
  if (!steps || steps.length === 0) return null;
  return (
    <QuoteSection id="next-steps" title="מה קורה אחרי שחותמים?" intro="ככה זה ממשיך אחרי החתימה, צעד אחרי צעד.">
      <div className="mx-auto max-w-xl">
        <Timeline
          items={steps}
          renderItem={(s) => (
            <div className="pt-1">
              <p className="text-lg font-semibold text-foreground">{s.text}</p>
              {s.desc && <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">{s.desc}</p>}
            </div>
          )}
        />
      </div>
    </QuoteSection>
  );
}
