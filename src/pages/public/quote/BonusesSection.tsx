import { Gift } from "lucide-react";
import { shekel } from "@/lib/quote-pricing";
import type { QuoteBonus } from "@/lib/quote-v2";
import { QuoteSection, RevealItem, RevealStagger } from "./Reveal";

/** "מתנות" , bonuses thrown in on top of the scope, each with an optional
 *  shown value (only when the value is actually meaningful, i.e. > 0). */
export function BonusesSection({ bonuses }: { bonuses: QuoteBonus[] }) {
  if (!bonuses || bonuses.length === 0) return null;
  return (
    <QuoteSection id="bonuses" title="מתנות" intro="כמה דברים שאני מוסיף בלי חיוב נוסף.">
      <RevealStagger className="grid gap-3 sm:grid-cols-2">
        {bonuses.map((b) => (
          <RevealItem key={b.id}>
            <div className="flex h-full items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                <Gift className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">{b.name}</p>
                {b.desc && <p className="mt-1 text-base leading-relaxed text-muted-foreground">{b.desc}</p>}
                {b.value > 0 && <p className="mt-1.5 text-xs font-medium text-primary">שווי {shekel(b.value)}</p>}
              </div>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </QuoteSection>
  );
}
