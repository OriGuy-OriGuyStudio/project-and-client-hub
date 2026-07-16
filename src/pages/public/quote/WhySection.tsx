import { Sparkle } from "lucide-react";
import type { QuoteDiff } from "@/lib/quote-v2";
import { QuoteSection } from "./Reveal";

/** "למה איתי" , differentiator cards, in Ori's own voice. */
export function WhySection({ items }: { items: QuoteDiff[] }) {
  if (!items || items.length === 0) return null;
  return (
    <QuoteSection id="why" title="למה איתי">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((d) => (
          <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkle className="size-4" />
            </span>
            <p className="mt-2.5 text-sm font-semibold text-foreground">{d.title}</p>
            {d.desc && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{d.desc}</p>}
          </div>
        ))}
      </div>
    </QuoteSection>
  );
}
