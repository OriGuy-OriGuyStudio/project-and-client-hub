// Quote builder , price panel (Task 5 of the v2 rebuild).
// Renders the 3 priced options (fair/recommended/premium) derived from the
// live scope anchor via quoteTotals, a manual final-price override with a
// soft below-floor warning, and a disabled "price with AI" placeholder.
// See .superpowers/sdd/task-5-brief.md and lib/quote-v2.ts / lib/quote-pricing.ts.

import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { belowFloor, shekel, type PriceOption } from "@/lib/quote-pricing";
import { quoteTotals, type QuoteContentV2, type QuoteSelected } from "@/lib/quote-v2";

/** No upsells/discount/maintenance chosen yet at this stage of the builder ,
 *  the price panel only needs the 3 base options + `chosen`, both of which
 *  are independent of the client-facing selection. */
const EMPTY_SELECTION: QuoteSelected = { upsell_ids: [], maintenance_tier: null };

export function PricePanel({
  content,
  multipliers,
  disabled,
  onSetFinal,
}: {
  content: QuoteContentV2;
  multipliers: { fair: number; recommended: number; premium: number; floor: number };
  disabled: boolean;
  onSetFinal: (price: number) => void;
}) {
  const { options, chosen } = quoteTotals(
    content,
    EMPTY_SELECTION,
    { fair: multipliers.fair, recommended: multipliers.recommended, premium: multipliers.premium },
    multipliers.floor,
    () => 0,
  );

  const under = belowFloor(content.final_price, multipliers.floor);

  return (
    <Card className="space-y-4 p-5">
      <div>
        <p className="text-sm font-semibold text-foreground">מחיר</p>
        <p className="text-xs text-muted-foreground">שלוש אפשרויות תמחור לפי היקף ההצעה, או מחיר ידני משלך.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <PriceOptionCard
            key={option.key}
            option={option}
            selected={chosen === option.key}
            disabled={disabled}
            onSelect={() => onSetFinal(option.price)}
          />
        ))}
      </div>

      <div className="space-y-1.5 border-t border-border pt-4">
        <label htmlFor="final-price-override" className="text-sm font-medium text-foreground">
          מחיר סופי ידני
        </label>
        <Input
          id="final-price-override"
          type="number"
          value={content.final_price}
          disabled={disabled}
          onChange={(e) => onSetFinal(Number(e.target.value) || 0)}
          className="max-w-[200px] text-end"
        />
        {under && (
          <p className="text-xs text-warning">
            המחיר מתחת לרצפת הסטודיו ({shekel(multipliers.floor)}). זה עדיין יישמר, רק שים לב.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          disabled
          className="inline-flex h-10 shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-primary/15 px-5 text-sm font-medium text-primary opacity-60"
        >
          <Sparkles className="size-4" />
          עזור לי לתמחר עם AI
        </button>
        <p className="text-xs text-muted-foreground">בקרוב</p>
      </div>
    </Card>
  );
}

function PriceOptionCard({
  option,
  selected,
  disabled,
  onSelect,
}: {
  option: PriceOption;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const isRecommended = option.key === "recommended";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-start gap-1.5 rounded-xl border p-4 text-start transition-colors",
        selected
          ? "border-primary bg-primary/15"
          : "border-border bg-field hover:border-primary/40",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      {isRecommended && (
        <span className="absolute -top-2.5 inline-flex items-center rounded-full border border-primary bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
          מומלץ
        </span>
      )}
      <span className={cn("text-sm font-semibold", selected ? "text-primary" : "text-foreground")}>
        {option.label}
      </span>
      <span className="font-heading text-xl font-bold text-foreground">{shekel(option.price)}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{option.rationale}</span>
    </button>
  );
}
