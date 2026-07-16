import type { QuoteStep } from "@/lib/quote-v2";
import { QuoteSection } from "./Reveal";
import { Timeline } from "./Timeline";

/** "השלבים הבאים" , what happens right after signing, as the same numbered
 *  vertical timeline as ProcessSection (shared `Timeline` component), just
 *  with plain-text node content instead of name+desc+duration. */
export function NextStepsSection({ steps }: { steps: QuoteStep[] }) {
  if (!steps || steps.length === 0) return null;
  return (
    <QuoteSection id="next-steps" title="השלבים הבאים">
      <div className="mx-auto max-w-xl">
        <Timeline
          items={steps}
          renderItem={(s) => (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-base text-foreground">{s.text}</p>
            </div>
          )}
        />
      </div>
    </QuoteSection>
  );
}
