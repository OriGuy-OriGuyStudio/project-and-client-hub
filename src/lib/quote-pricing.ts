export type QuoteType = "website" | "system" | "automation";
export type WebsiteSubtype =
  | "landing" | "portfolio" | "store" | "catalog" | "content" | "event" | "campaign" | "onepage";
export type ScopeItemKind = "subtype" | "page" | "feature" | "module" | "automation";

export type ScopeItem = { id: string; kind: ScopeItemKind; label: string; value: number };
export type QuoteScope = { type: QuoteType; subtype?: WebsiteSubtype; items: ScopeItem[] };

export function anchorValue(scope: QuoteScope): number {
  return (scope.items ?? []).reduce((sum, it) => sum + (Number(it.value) || 0), 0);
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
