import type { QuoteStep } from "@/lib/quote-v2";
import { QuoteSection } from "./Reveal";

/** "השלבים הבאים" , a short numbered list of what happens right after signing. */
export function NextStepsSection({ steps }: { steps: QuoteStep[] }) {
  if (!steps || steps.length === 0) return null;
  return (
    <QuoteSection id="next-steps" title="השלבים הבאים">
      <ol className="mx-auto max-w-xl space-y-2.5">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-start gap-3 rounded-xl bg-card px-4 py-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {i + 1}
            </span>
            <p className="text-base text-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
    </QuoteSection>
  );
}
