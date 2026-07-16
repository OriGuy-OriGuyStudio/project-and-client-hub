// Quote builder , price panel (Task 5 of the v2 rebuild; AI assist added in
// Plan 4 Task 3).
// Renders the 3 priced options (fair/recommended/premium) derived from the
// live scope anchor via quoteTotals, a manual final-price override with a
// soft below-floor warning, and an "עזור לי לתמחר עם AI" button that calls
// quoteAiPrice for a second opinion , the admin can apply any of its 3
// suggested prices via onSetFinal, same as the mechanical options. The AI
// never writes to the quote directly; it only offers numbers the admin picks.
// See .superpowers/sdd/task-5-brief.md and lib/quote-v2.ts / lib/quote-pricing.ts.

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { belowFloor, shekel, type PriceOption } from "@/lib/quote-pricing";
import { quoteTotals, type QuoteContentV2, type QuoteSelected } from "@/lib/quote-v2";
import { quoteAiPrice, type QuoteAiPriceResult } from "@/lib/quote-ai";
import { toastError } from "@/hooks/use-toast";

/** No upsells/discount/maintenance chosen yet at this stage of the builder ,
 *  the price panel only needs the 3 base options + `chosen`, both of which
 *  are independent of the client-facing selection. */
const EMPTY_SELECTION: QuoteSelected = { upsell_ids: [], optional_ids: [], maintenance_tier: null };

export function PricePanel({
  content,
  multipliers,
  disabled,
  onSetFinal,
  clientBusiness,
}: {
  content: QuoteContentV2;
  multipliers: { fair: number; recommended: number; premium: number; floor: number };
  disabled: boolean;
  onSetFinal: (price: number) => void;
  /** Client business name, top-level DB column in QuoteBuilderShell (not part
   *  of `content`) , passed through to give the AI assist a hint about who
   *  the quote is for. Optional; the AI prompt still works without it. */
  clientBusiness?: string;
}) {
  const { anchor, options, chosen } = quoteTotals(
    content,
    EMPTY_SELECTION,
    { fair: multipliers.fair, recommended: multipliers.recommended, premium: multipliers.premium },
    multipliers.floor,
    () => 0,
  );

  const under = content.final_price > 0 && belowFloor(content.final_price, multipliers.floor);

  const [aiPending, setAiPending] = useState(false);
  const [aiResult, setAiResult] = useState<QuoteAiPriceResult | null>(null);

  // A type switch changes the whole scope/anchor basis , a stale AI result
  // from the previous type would be misleading, so drop it.
  useEffect(() => {
    setAiResult(null);
  }, [content.type]);

  async function handleAiPrice() {
    setAiPending(true);
    try {
      const scope = content.scope
        .filter((it) => !it.optional && !it.free)
        .map((it) => ({ label: it.label, value: it.value }));
      const result = await quoteAiPrice({
        type: content.type,
        subtype: content.subtype,
        client_business: clientBusiness,
        scope,
        anchor,
        options: {
          fair: options.find((o) => o.key === "fair")?.price ?? 0,
          recommended: options.find((o) => o.key === "recommended")?.price ?? 0,
          premium: options.find((o) => o.key === "premium")?.price ?? 0,
        },
        floor: multipliers.floor,
        notes: content.notes,
      });
      setAiResult(result);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "ה-AI לא הצליח להציע מחיר, נסה שוב.");
    } finally {
      setAiPending(false);
    }
  }

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
          disabled={disabled || aiPending}
          onClick={handleAiPrice}
          className={cn(
            "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary/15 px-5 text-sm font-medium text-primary transition-colors hover:bg-primary/25",
            (disabled || aiPending) && "cursor-not-allowed opacity-60 hover:bg-primary/15"
          )}
        >
          {aiPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {aiPending ? "חושב על זה…" : "עזור לי לתמחר עם AI"}
        </button>
        {aiResult && !aiPending && (
          <p className="text-xs text-muted-foreground">הרצה חדשה תחליף את ההמלצה הקודמת.</p>
        )}
      </div>

      {aiResult && (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">המלצת AI</p>
            <span className="text-[10px] text-muted-foreground">הצעה של AI, ההחלטה שלך</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <AiPriceCard label="הוגן" option={aiResult.fair} disabled={disabled} onApply={() => onSetFinal(aiResult.fair.price)} />
            <AiPriceCard
              label="מומלץ"
              option={aiResult.recommended}
              disabled={disabled}
              onApply={() => onSetFinal(aiResult.recommended.price)}
            />
            <AiPriceCard
              label="פרימיום"
              option={aiResult.premium}
              disabled={disabled}
              onApply={() => onSetFinal(aiResult.premium.price)}
            />
          </div>

          {aiResult.advice && (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
              {aiResult.advice}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function AiPriceCard({
  label,
  option,
  disabled,
  onApply,
}: {
  label: string;
  option: { price: number; rationale: string };
  disabled: boolean;
  onApply: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-lg border border-border bg-field p-3 text-start">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <span className="font-heading text-lg font-bold text-foreground">{shekel(option.price)}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{option.rationale}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onApply}
        className={cn(
          "mt-1 inline-flex h-7 items-center justify-center rounded-lg border border-primary/40 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/15",
          disabled && "cursor-not-allowed opacity-60 hover:bg-transparent"
        )}
      >
        בחר
      </button>
    </div>
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
