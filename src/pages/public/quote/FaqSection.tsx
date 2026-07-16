import { ChevronDown } from "lucide-react";
import type { QuoteFaq } from "@/lib/quote-v2";
import { QuoteSection } from "./Reveal";

/** "שאלות ותשובות" , a native <details>/<summary> accordion (no JS state
 *  needed, works with prefers-reduced-motion automatically since there's no
 *  animation, and is keyboard/screen-reader accessible out of the box). */
export function FaqSection({ faq }: { faq: QuoteFaq[] }) {
  if (!faq || faq.length === 0) return null;
  return (
    <QuoteSection id="faq" title="שאלות ותשובות">
      <div className="space-y-2">
        {faq.map((f) => (
          <details key={f.id} className="group rounded-2xl border border-border bg-card px-4 py-3 open:pb-4">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-base font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              {f.q}
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </QuoteSection>
  );
}
