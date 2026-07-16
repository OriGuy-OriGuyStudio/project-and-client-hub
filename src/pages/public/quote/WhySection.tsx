import { Sparkle } from "lucide-react";
import type { QuoteDiff } from "@/lib/quote-v2";
import { QuoteSection, RevealItem, RevealStagger } from "./Reveal";

/** "למה איתי" , differentiator cards, in Ori's own voice. Flex-wrap +
 *  justify-center (each card ~half width minus half the gap) instead of a
 *  strict 2-col grid, so a lone last card in an odd-length list centers
 *  itself under the row above rather than sitting flush to one side , works
 *  for any count (2, 3, 4…), not just this list's current length. */
export function WhySection({ items }: { items: QuoteDiff[] }) {
  if (!items || items.length === 0) return null;
  return (
    <QuoteSection id="why" title="למה איתי">
      <RevealStagger className="flex flex-wrap justify-center gap-3">
        {items.map((d) => (
          <RevealItem key={d.id} className="w-full sm:basis-[calc(50%-0.375rem)]">
            <div className="h-full rounded-2xl border border-border bg-card p-4">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Sparkle className="size-4" />
              </span>
              <p className="mt-2.5 text-sm font-semibold text-foreground">{d.title}</p>
              {d.desc && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d.desc}</p>}
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </QuoteSection>
  );
}
