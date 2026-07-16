import { Gift } from "lucide-react";
import { shekel } from "@/lib/quote-pricing";
import type { QuoteBonus } from "@/lib/quote-v2";
import { QuoteSection, RevealItem, RevealStagger } from "./Reveal";

/** "מתנות" , bonuses thrown in on top of the scope, each with an optional
 *  shown value (only when the value is actually meaningful, i.e. > 0). Solid
 *  cards (bg-card, not a tinted-transparent panel) so the section reads as
 *  clearly as every other card on the page; the "שווי ₪X" line is a small
 *  chip pinned to the card's bottom so equal-height cards in a row line up
 *  regardless of how long each description runs. */
export function BonusesSection({ bonuses }: { bonuses: QuoteBonus[] }) {
  if (!bonuses || bonuses.length === 0) return null;
  return (
    <QuoteSection id="bonuses" title="מתנות שכבר בפנים" intro="כמה דברים שאני מוסיף בלי חיוב נוסף.">
      {/* flex-wrap + justify-center instead of a 2-col grid, so an odd last
         card sits centered under the row instead of hanging alone on one
         side (Ori: "מצב כזה של מתנות צריך להיות ממורכז"). Each card takes
         half the row minus half the 1rem gap, i.e. the same width the grid
         gave it. */}
      <RevealStagger className="flex flex-wrap justify-center gap-4">
        {bonuses.map((b) => (
          <RevealItem key={b.id} className="w-full sm:w-[calc(50%-0.5rem)]">
            <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Gift className="size-5" />
                </span>
                <p className="text-lg font-semibold leading-snug text-foreground">{b.name}</p>
              </div>
              {b.desc && <p className="text-base leading-relaxed text-muted-foreground">{b.desc}</p>}
              {b.value > 0 && (
                <span className="mt-auto inline-flex w-fit items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  שווי {shekel(b.value)}
                </span>
              )}
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </QuoteSection>
  );
}
