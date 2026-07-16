import { useMemo } from "react";
import { Check, Circle, CheckCircle2 } from "lucide-react";
import { DEFAULT_MULTIPLIERS, shekel } from "@/lib/quote-pricing";
import { quoteTotals, type QuoteContentV2, type QuoteSelected } from "@/lib/quote-v2";
import { cn } from "@/lib/utils";
import { sparkBurst } from "@/lib/confetti";
import BorderGlow from "@/components/reactbits/BorderGlow";
import { QuoteSection, RevealItem, RevealStagger } from "./Reveal";

/** Pointer-driven glow on the summary card. Brand green (`--primary`, dark
 *  theme) in the three shapes BorderGlow's own API expects: "H S L" numbers
 *  for the glow itself, and hex shades for the gradient sweep. */
const SUMMARY_GLOW_COLOR = "80 53 64"; // #B4D670 as H S L
const SUMMARY_GLOW_SHADES = ["#B4D670", "#8fb84f", "#d3ec9f"];
const SUMMARY_CARD_BG = "#161520"; // --card (dark theme)

/** Module-level throttle so a burst of rapid taps (or the two toggle sites
 *  , extras and maintenance tiers) never stacks more than one confetti burst
 *  per 800ms. A single PricingSection instance is ever mounted per page, so
 *  a plain module variable is enough (no need to thread this through state
 *  or a ref). */
let lastCelebrationAt = 0;

/** Fires a small, contained confetti burst from the toggled row's own
 *  position (not a full-screen blast) when the client SELECTS an extra or
 *  maintenance tier, never on deselect. `sparkBurst` already no-ops under
 *  `prefers-reduced-motion`. */
function celebrateSelection(e: React.MouseEvent<HTMLButtonElement>) {
  const now = Date.now();
  if (now - lastCelebrationAt < 800) return;
  lastCelebrationAt = now;
  const rect = e.currentTarget.getBoundingClientRect();
  sparkBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

/** A single toggleable extra row (optional scope item or upsell). Same shape
 *  for both so the picker reads as one list, not two. Clean module row: text
 *  on the start side, price + a circular check indicator on the end side.
 *  Selected state is an emphasized border (never a filled background , the
 *  "noisy background" the redesign moved away from). */
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
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={readOnly}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-2xl border bg-card p-4 text-start transition-colors sm:p-5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected ? "border-primary ring-1 ring-primary/50" : "border-border",
        !readOnly && !selected && "hover:border-primary/40",
        readOnly ? "cursor-default" : "cursor-pointer",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-medium text-foreground">{label}</p>
          {recommended && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              מומלץ
            </span>
          )}
        </div>
        {desc && <p className="mt-0.5 text-base leading-relaxed text-muted-foreground">{desc}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-semibold text-foreground">{shekel(price)}</span>
        <span
          aria-hidden="true"
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent",
          )}
        >
          <Check className="size-3.5" />
        </span>
      </div>
    </button>
  );
}

/** A single maintenance tier row, radio-style (single select, deselectable).
 *  Selected tier inverts to a high-contrast light card (bg-primary, dark
 *  text) so it reads as clearly "chosen" against the otherwise-dark rows;
 *  unselected tiers stay the normal dark card. */
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
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={readOnly}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-start transition-colors sm:p-5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
        !readOnly && !selected && "hover:border-primary/40",
        readOnly ? "cursor-default" : "cursor-pointer",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold">{name}</p>
          {recommended && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                selected ? "bg-primary-foreground/10 text-primary-foreground" : "bg-primary/15 text-primary",
              )}
            >
              מומלץ
            </span>
          )}
        </div>
        {description && (
          <p className={cn("mt-0.5 text-base leading-relaxed", selected ? "text-primary-foreground/75" : "text-muted-foreground")}>
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-semibold">
          {shekel(price)}
          <span className={cn("text-xs font-normal", selected ? "text-primary-foreground/70" : "text-muted-foreground")}>
            /חודש
          </span>
        </span>
        {selected ? (
          <CheckCircle2 aria-hidden="true" className="size-5" />
        ) : (
          <Circle aria-hidden="true" className="size-5 text-muted-foreground/70" />
        )}
      </div>
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
 *  never adds arithmetic beyond summing/listing the selected extras and the
 *  bonuses' display-only "gross value" line (item 4) for display. */
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

  // Receipt lines: one per SELECTED extra (by name), in the same order
  // they're offered (optional scope, then upsells).
  const selectedExtraLines = useMemo(() => {
    const optionalSelected = new Set(selected.optional_ids ?? []);
    const upsellSelected = new Set(selected.upsell_ids ?? []);
    return [
      ...optionalScopeItems
        .filter((it) => optionalSelected.has(it.id))
        .map((it) => ({ id: it.id, label: it.label, price: Number(it.value) || 0 })),
      ...upsells
        .filter((u) => upsellSelected.has(u.id))
        .map((u) => ({ id: u.id, label: u.title, price: Number(u.price) || 0 })),
    ];
  }, [optionalScopeItems, upsells, selected.optional_ids, selected.upsell_ids]);

  // Item 4: bonuses amplify the perceived value of the total, pure display ,
  // `gross` (pre-discount project + extras) is exactly `totals.net +
  // totals.discount` (quoteTotals' own internal `gross` before the discount
  // was subtracted), so this never re-derives pricing math of its own.
  const bonusesTotal = (content.bonuses ?? []).reduce((sum, b) => sum + (Number(b.value) || 0), 0);
  const grossWithBonuses = totals.net + totals.discount + bonusesTotal;

  // Functional updates so rapid taps in one React batch never clobber each
  // other (a stale-closure spread over `selected` would drop the earlier tap).
  function toggleOptionalScope(id: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (readOnly) return;
    const isSelecting = !(selected.optional_ids ?? []).includes(id);
    onSelectedChange((prev) => {
      const set = new Set(prev.optional_ids ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, optional_ids: Array.from(set) };
    });
    if (isSelecting) celebrateSelection(e);
  }

  function toggleUpsell(id: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (readOnly) return;
    const isSelecting = !(selected.upsell_ids ?? []).includes(id);
    onSelectedChange((prev) => {
      const set = new Set(prev.upsell_ids ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, upsell_ids: Array.from(set) };
    });
    if (isSelecting) celebrateSelection(e);
  }

  function toggleTier(key: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (readOnly) return;
    const isSelecting = selected.maintenance_tier !== key;
    onSelectedChange((prev) => ({
      ...prev,
      maintenance_tier: prev.maintenance_tier === key ? null : key,
    }));
    if (isSelecting) celebrateSelection(e);
  }

  return (
    <>
      <QuoteSection id="pricing" title="המחיר" intro="ככה זה נראה במספרים, בלי הפתעות.">
        <div className="space-y-8">
          {hasExtras && (
            <div>
              <h3 className="text-lg font-semibold text-foreground">תוספות לבחירה</h3>
              <p className="mt-1 text-base text-muted-foreground">כל תוספת כאן היא בחירה שלך, אין חובה לסמן כלום.</p>
              <RevealStagger className="mt-3 space-y-2.5">
                {optionalScopeItems.map((it) => (
                  <RevealItem key={it.id}>
                    <ExtraCard
                      label={it.label}
                      desc={it.desc}
                      price={Number(it.value) || 0}
                      selected={(selected.optional_ids ?? []).includes(it.id)}
                      readOnly={readOnly}
                      onToggle={(e) => toggleOptionalScope(it.id, e)}
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
                      onToggle={(e) => toggleUpsell(u.id, e)}
                    />
                  </RevealItem>
                ))}
              </RevealStagger>
            </div>
          )}

          {hasMaintenance && (
            <div>
              <h3 className="text-lg font-semibold text-foreground">ליווי אחרי ההשקה</h3>
              <p className="mt-1 text-base text-muted-foreground">
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
                      onToggle={(e) => toggleTier(t.key, e)}
                    />
                  </RevealItem>
                ))}
              </RevealStagger>
              <p className="mt-2 text-base text-muted-foreground">אפשר להצטרף גם אחרי העלייה לאוויר.</p>
            </div>
          )}

          <div id="pricing-summary" className="scroll-mt-24">
            <BorderGlow
              backgroundColor={SUMMARY_CARD_BG}
              borderRadius={16}
              glowColor={SUMMARY_GLOW_COLOR}
              glowIntensity={0.8}
              edgeSensitivity={30}
              colors={SUMMARY_GLOW_SHADES}
            >
              <div className="p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-foreground">ההצעה שלך</h3>

                {/* The receipt , the project's line, then one line per
                   selected extra (by name), then the discount. The ex-VAT/
                   incl-VAT split stays in the totals box below so the single
                   number the client anchors on is the ex-VAT price (the
                   market-standard convention), never the incl-VAT total. */}
                <div className="mt-4 space-y-2 rounded-2xl bg-background/50 p-4">
                  <SummaryRow label="הפרויקט" value={shekel(content.final_price)} />
                  {selectedExtraLines.map((line) => (
                    <SummaryRow key={line.id} label={line.label} value={`+${shekel(line.price)}`} />
                  ))}
                  {totals.discount > 0 && (
                    <SummaryRow
                      label={`- הנחה${content.discount?.label ? ` (${content.discount.label})` : ""}`}
                      value={`-${shekel(totals.discount)}`}
                    />
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-center sm:p-5">
                  {bonusesTotal > 0 && (
                    <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/60">
                      שווי מלא כולל מתנות: {shekel(grossWithBonuses)}
                    </p>
                  )}
                  <p className="text-xs font-medium text-muted-foreground">סה"כ (לפני מע"מ)</p>
                  <p className="mt-1 font-heading text-3xl font-black text-primary sm:text-4xl">{shekel(totals.net)}</p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    מע"מ ({content.vat_pct}%): {shekel(totals.vat)} · סה"כ לתשלום כולל מע"מ: {shekel(totals.total)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    מקדמה {totals.split.depositPct}%: {shekel(totals.split.deposit)} · יתרה: {shekel(totals.split.rest)} (כולל מע"מ)
                  </p>
                </div>

                {selectedTier && (
                  <div className="mt-4 flex justify-center">
                    <span className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5 text-sm font-semibold text-primary">
                      + {selectedTier.name}: {shekel(selectedTier.price)}/חודש
                    </span>
                  </div>
                )}

                <div className="mt-4 space-y-1.5">
                  <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Check aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                    אפשר להוסיף או להוריד תוספות עד רגע החתימה.
                  </p>
                  <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Check aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                    ליווי חודשי אפשר לבטל בכל רגע.
                  </p>
                </div>
              </div>
            </BorderGlow>
          </div>
        </div>
      </QuoteSection>

      {/* Mobile sticky summary bar , always visible on small screens so the
         total + sign CTA (or, once signed, the approval recap) are reachable
         without scrolling back up. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-primary/20 bg-background/95 px-4 py-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0 rounded-xl bg-primary/10 px-3 py-1.5">
            <p className="text-xs text-muted-foreground">סה"כ (לפני מע"מ)</p>
            <p className="truncate font-heading text-lg font-black text-primary">{shekel(totals.net)}</p>
            <p className="text-xs text-muted-foreground">כולל מע"מ: {shekel(totals.total)}</p>
          </div>
          <a
            href="#sign"
            className="flex min-h-10 shrink-0 items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-[color:var(--ink,#0a0623)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {readOnly ? "האישור שלך" : "לחתימה"}
          </a>
        </div>
      </div>
    </>
  );
}
