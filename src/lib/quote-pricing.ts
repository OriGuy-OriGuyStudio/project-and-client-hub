export type QuoteType = "website" | "system" | "automation";
export type WebsiteSubtype =
  | "landing" | "portfolio" | "store" | "catalog" | "content" | "event" | "campaign" | "onepage";
export type ScopeItemKind = "subtype" | "page" | "feature" | "module" | "automation";

export type ScopeItem = {
  id: string;
  kind: ScopeItemKind;
  label: string;
  value: number;
  /** Client-selectable add-on, excluded from the anchor. */
  optional?: boolean;
  /** Included in the package (shown to the client) but adds ₪0 to the anchor,
   *  a value-stack , mutually exclusive with `optional`. */
  free?: boolean;
  /** Snapshot of the catalog row's description at pick time (never re-read
   *  live , the client page can't see the catalog, only the quote snapshot). */
  desc?: string;
};
export type QuoteScope = { type: QuoteType; subtype?: WebsiteSubtype; items: ScopeItem[] };

export function anchorValue(scope: QuoteScope): number {
  return (scope.items ?? [])
    .filter((it) => !it.optional && !it.free)
    .reduce((sum, it) => sum + (Number(it.value) || 0), 0);
}

export type Multipliers = { fair: number; recommended: number; premium: number };
export type PriceOptionKey = "fair" | "recommended" | "premium";
export type PriceOption = { key: PriceOptionKey; label: string; price: number; rationale: string };

export const DEFAULT_MULTIPLIERS: Multipliers = { fair: 1, recommended: 1.25, premium: 1.5 };

const OPTION_META: Record<PriceOptionKey, { label: string; rationale: string }> = {
  fair: { label: "הוגן", rationale: "נכנס לפרויקט, עדיין פרימיום. לתקציב מוגבל או סגירה מהירה." },
  recommended: { label: "מומלץ", rationale: "המחיר שאני ממליץ עליו ברוב המקרים. מאזן ערך ומרווח, ומשאיר מקום לאפסייל." },
  premium: { label: "פרימיום", rationale: "כשהלקוח מבין ערך, או כשההיקף, הסיכון והדחיפות גבוהים." },
};

export function priceOptions(anchor: number, mult: Multipliers, floor: number): PriceOption[] {
  return (["fair", "recommended", "premium"] as PriceOptionKey[]).map((key) => ({
    key,
    label: OPTION_META[key].label,
    rationale: OPTION_META[key].rationale,
    price: Math.max(Math.round((anchor || 0) * mult[key]), Math.round(floor || 0)),
  }));
}

export function belowFloor(price: number, floor: number): boolean {
  return (price || 0) < (floor || 0);
}

export type BreakdownLine = ScopeItem & { price: number };

export function breakdownForFinal(items: ScopeItem[], finalPrice: number): BreakdownLine[] {
  const list = items ?? [];
  if (list.length === 0) return [];
  const total = list.reduce((s, i) => s + (Number(i.value) || 0), 0);
  if (total <= 0) {
    return list.map((it, i) => ({ ...it, price: i === 0 ? Math.round(finalPrice) : 0 }));
  }
  let acc = 0;
  return list.map((it, i) => {
    const price = i === list.length - 1
      ? Math.round(finalPrice) - acc
      : Math.round(((Number(it.value) || 0) / total) * finalPrice);
    acc += price;
    return { ...it, price };
  });
}

export function withVat(net: number, pct: number): number {
  return Math.round((net || 0) * (1 + (pct || 0) / 100));
}

export function vatOf(net: number, pct: number): number {
  return withVat(net, pct) - Math.round(net || 0);
}

export function paymentSplit(total: number, depositPct: number): { deposit: number; rest: number; depositPct: number } {
  const pct = Math.min(100, Math.max(0, depositPct ?? 50));
  const deposit = Math.round((total * pct) / 100);
  return { deposit, rest: Math.max(0, Math.round(total) - deposit), depositPct: pct };
}

export function shekel(n: number): string {
  return "₪" + Math.round(n || 0).toLocaleString("he-IL");
}
