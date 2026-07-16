import { useMemo } from "react";
import { Check, Circle, CheckCircle2 } from "lucide-react";
import { DEFAULT_MULTIPLIERS, shekel } from "@/lib/quote-pricing";
import { quoteTotals, type QuoteContentV2, type QuoteSelected } from "@/lib/quote-v2";
import { cn } from "@/lib/utils";
import { QuoteSection, RevealItem, RevealStagger } from "./Reveal";

/** A single toggleable extra card (optional scope item or upsell). Same shape
 *  for both so the picker reads as one list, not two. */
function ExtraCard({
  label,
  desc,
  price,
  selected,
  recommended,
  readOnly,
  onToggle,
}: {
  label: string;
  desc?: string;
  price: number;
  selected: boolean;
  recommended?: boolean;
  readOnly: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={readOnly}
      onClick={onToggle}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-2xl border p-4 text-start transition-colors",
        selected ? "border-primary/50 bg-primary/10" : "border-border bg-card",
        !readOnly && !selected && "hover:border-primary/30",
        readOnly ? "cursor-default" : "cursor-pointer",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
            selected ? "border-primary bg-primary text-[color:var(--ink,#0a0623)]" : "border-border text-transparent",
          )}
        >
          <Check className="size-3" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{label}</p>
            {recommended && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                מומלץ
              </span>
            )}
          </div>
          {desc && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>}
        </div>
      </div>
      <span className="shrink-0 text-sm font-semibold text-foreground">{shekel(price)}</span>
    </button>
  );
}

/** A single maintenance tier card, radio-style (single select, deselectable). */
function TierCard({
  name,
  description,
  price,
  selected,
  recommended,
  readOnly,
  onToggle,
}: {
  name: string;
  description?: string;
  price: number;
  selected: boolean;
  recommended?: boolean;
  readOnly: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={readOnly}
      onClick={onToggle}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-2xl border p-4 text-start transition-colors",
        selected ? "border-primary/50 bg-primary/10" : "border-border bg-card",
        !readOnly && !selected && "hover:border-primary/30",
        readOnly ? "cursor-default" : "cursor-pointer",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 shrink-0 text-primary">
          {selected ? <CheckCircle2 className="size-5" /> : <Circle className="size-5 text-muted-foreground/50" />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{name}</p>
            {recommended && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                מומלץ
              </span>
            )}
          </div>
          {description && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      <span className="shrink-0 text-sm font-semibold text-foreground">
        {shekel(price)}
        <span className="text-xs font-normal text-muted-foreground">/חודש</span>
      </span>
    </button>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", muted ? "text-xs text-muted-foreground" : "text-sm")}>
      <span className={cn(muted ? "text-muted-foreground" : "text-foreground")}>{label}</span>
      <span className={cn(bold ? "font-semibold text-foreground" : muted ? "text-muted-foreground" : "font-medium text-foreground")}>
        {value}
      </span>
    </div>
  );
}

/** "המחיר" , the interactive pricing section: optional extras + maintenance
 *  tier pickers, and a live summary that's the ONLY place on the page the
 *  client sees a bottom-line total (never the admin's 3 options/anchor). All
 *  math comes from a single `quoteTotals` call per render; this component
 *  never adds arithmetic beyond summing the two extras totals for display. */
export function PricingSection({
  content,
  selected,
  onSelectedChange,
  readOnly,
}: {
  content: QuoteContentV2;
  selected: QuoteSelected;
  onSelectedChange: React.Dispatch<React.SetStateAction<QuoteSelected>>;
  readOnly: boolean;
}) {
  const totals = useMemo(
    () => quoteTotals(content, selected, DEFAULT_MULTIPLIERS, 0, () => 0),
    [content, selected],
  );

  const optionalScopeItems = (content.scope ?? []).filter((it) => it.optional && !it.free);
  const upsells = content.upsells ?? [];
  const hasExtras = optionalScopeItems.length > 0 || upsells.length > 0;

  const tiers = content.maintenance?.tiers ?? [];
  const hasMaintenance = !!content.maintenance?.offer && tiers.length > 0;

  const selectedTier = selected.maintenance_tier
    ? tiers.find((t) => t.key === selected.maintenance_tier)
    : undefined;

  const extrasTotal = totals.optionalScopeTotal + totals.upsellsTotal;

  // Functional updates so rapid taps in one React batch never clobber each
  // other (a stale-closure spread over `selected` would drop the earlier tap).
  function toggleOptionalScope(id: string) {
    if (readOnly) return;
    onSelectedChange((prev) => {
      const set = new Set(prev.optional_ids ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, optional_ids: Array.from(set) };
    });
  }

  function toggleUpsell(id: string) {
    if (readOnly) return;
    onSelectedChange((prev) => {
      const set = new Set(prev.upsell_ids ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, upsell_ids: Array.from(set) };
    });
  }

  function toggleTier(key: string) {
    if (readOnly) return;
    onSelectedChange((prev) => ({
      ...prev,
      maintenance_tier: prev.maintenance_tier === key ? null : key,
    }));
  }

  return (
    <>
      <QuoteSection id="pricing" title="המחיר" intro="ככה זה נראה במספרים, בלי הפתעות.">
        <div className="space-y-8">
          {hasExtras && (
            <div>
              <h3 className="text-sm font-semibold text-foreground">תוספות לבחירה</h3>
              <p className="mt-1 text-sm text-muted-foreground">כל תוספת כאן היא בחירה שלך, אין חובה לסמן כלום.</p>
              <RevealStagger className="mt-3 space-y-2.5">
                {optionalScopeItems.map((it) => (
                  <RevealItem key={it.id}>
                    <ExtraCard
                      label={it.label}
                      desc={it.desc}
                      price={Number(it.value) || 0}
                      selected={(selected.optional_ids ?? []).includes(it.id)}
                      readOnly={readOnly}
                      onToggle={() => toggleOptionalScope(it.id)}
                    />
                  </RevealItem>
                ))}
                {upsells.map((u) => (
                  <RevealItem key={u.id}>
                    <ExtraCard
                      label={u.title}
                      desc={u.desc}
                      price={Number(u.price) || 0}
                      selected={(selected.upsell_ids ?? []).includes(u.id)}
                      recommended={u.recommended}
                      readOnly={readOnly}
                      onToggle={() => toggleUpsell(u.id)}
                    />
                  </RevealItem>
                ))}
              </RevealStagger>
            </div>
          )}

          {hasMaintenance && (
            <div>
              <h3 className="text-sm font-semibold text-foreground">ליווי אחרי ההשקה</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                אם תרצו שאני אמשיך לתחזק, לעדכן ולגבות אחרי שהפרויקט עולה לאוויר.
              </p>
              <RevealStagger className="mt-3 space-y-2.5">
                {tiers.map((t) => (
                  <RevealItem key={t.key}>
                    <TierCard
                      name={t.name}
                      description={t.description}
                      price={t.price}
                      selected={selected.maintenance_tier === t.key}
                      recommended={t.recommended}
                      readOnly={readOnly}
                      onToggle={() => toggleTier(t.key)}
                    />
                  </RevealItem>
                ))}
              </RevealStagger>
              <p className="mt-2 text-sm text-muted-foreground">אפשר להצטרף גם אחרי העלייה לאוויר.</p>
            </div>
          )}

          <div id="pricing-summary" className="scroll-mt-24 rounded-3xl border border-primary/30 bg-primary/5 p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-foreground">סיכום</h3>

            <div className="mt-4 space-y-2 rounded-2xl bg-background/50 p-4">
              <SummaryRow label="מחיר הפרויקט" value={shekel(content.final_price)} />
              {extrasTotal > 0 && <SummaryRow label="+ תוספות שבחרת" value={`+${shekel(extrasTotal)}`} />}
              {totals.discount > 0 && (
                <SummaryRow
                  label={`- הנחה${content.discount?.label ? ` (${content.discount.label})` : ""}`}
                  value={`-${shekel(totals.discount)}`}
                />
              )}
              <SummaryRow label='לפני מע"מ' value={shekel(totals.net)} />
              <SummaryRow label={`מע"מ (${content.vat_pct}%)`} value={shekel(totals.vat)} muted />
            </div>

            <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-center sm:p-5">
              <p className="text-xs font-medium text-muted-foreground">סה"כ כולל מע"מ</p>
              <p className="mt-1 font-heading text-3xl font-black text-primary sm:text-4xl">{shekel(totals.total)}</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground">
                מקדמה {totals.split.depositPct}%: {shekel(totals.split.deposit)}
              </span>
              <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground">
                יתרה: {shekel(totals.split.rest)}
              </span>
              {selectedTier && (
                <span className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary">
                  + {selectedTier.name}: {shekel(selectedTier.price)}/חודש
                </span>
              )}
            </div>
          </div>
        </div>
      </QuoteSection>

      {/* Mobile sticky summary bar , always visible on small screens so the
         total + sign CTA (or, once signed, the approval recap) are reachable
         without scrolling back up. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-primary/20 bg-background/95 px-4 py-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0 rounded-xl bg-primary/10 px-3 py-1.5">
            <p className="text-[11px] text-muted-foreground">סה"כ כולל מע"מ</p>
            <p className="truncate font-heading text-lg font-black text-primary">{shekel(totals.total)}</p>
          </div>
          <a
            href="#sign"
            className="shrink-0 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-[color:var(--ink,#0a0623)]"
          >
            {readOnly ? "האישור שלך" : "לחתימה"}
          </a>
        </div>
      </div>
    </>
  );
}
