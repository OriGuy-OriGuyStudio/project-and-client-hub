import type { QuoteStep } from "@/lib/quote-v2";
import { QuoteSection } from "./Reveal";
import { Timeline } from "./Timeline";

/** "השלבים הבאים" , what happens right after signing, as the same numbered
 *  vertical timeline as ProcessSection (shared `Timeline` component), just
 *  with plain-text node content instead of name+desc+duration. */
export function NextStepsSection({ steps }: { steps: QuoteStep[] }) {
  if (!steps || steps.length === 0) return null;
  return (
    <QuoteSection id="next-steps" title="מה קורה אחרי שחותמים?" intro="ככה זה ממשיך אחרי החתימה, צעד אחרי צעד.">
      <div className="mx-auto max-w-xl">
        <Timeline
          items={steps}
          renderItem={(s) => (
            <p className="pt-1.5 text-lg font-medium text-foreground">{s.text}</p>
          )}
        />
      </div>
    </QuoteSection>
  );
}
