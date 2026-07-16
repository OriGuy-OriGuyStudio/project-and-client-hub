// Quote system v2 , content type + pure display helpers.
// Composes the tested pricing engine (./quote-pricing) rather than
// reimplementing any pricing math. See spec 2026-07-15-quote-system-v2-design.md.

import {
  anchorValue,
  priceOptions,
  breakdownForFinal,
  withVat,
  paymentSplit,
  type QuoteType,
  type WebsiteSubtype,
  type ScopeItem,
  type Multipliers,
  type PriceOption,
  type PriceOptionKey,
  type BreakdownLine,
} from "./quote-pricing";

/** A snapshot of one admin-curated maintenance tier (quote_maintenance_tiers),
 *  copied into the quote's content at pick time so later edits to the catalog
 *  never change a quote already built/sent (same pattern as QuoteUpsell). */
export type MaintenanceTierSnapshot = {
  key: string;
  name: string;
  price: number;
  description?: string;
  recommended?: boolean;
};

export type QuoteUpsell = { id: string; title: string; desc?: string; price: number; recommended?: boolean };
export type QuoteBonus = { id: string; name: string; desc?: string; value: number };
export type QuoteDiff = { id: string; title: string; desc?: string };
export type QuotePhase = { id: string; name: string; desc?: string; duration?: string };
export type QuoteStep = { id: string; text: string };
export type QuoteFaq = { id: string; q: string; a: string };
export type QuoteTestimonial = { quote: string; name: string; role?: string };
export type QuoteDiscount = { mode: "amount" | "percent"; value: number; label?: string };
export type QuotePayment = { deposit_pct: number; terms?: string };

export type QuoteContentV2 = {
  type: QuoteType;
  subtype?: string;
  /** Website-only: which platform the project is built on. Drives the legal
   *  clause swap in `applyPlatformClause`. Undefined for non-website quotes. */
  platform?: "custom" | "wordpress";
  narrative: string;
  scope: ScopeItem[];
  final_price: number;
  vat_pct: number;
  show_breakdown: boolean;
  upsells: QuoteUpsell[];
  maintenance: { offer: boolean; tiers: MaintenanceTierSnapshot[] };
  bonuses: QuoteBonus[];
  differentiators: QuoteDiff[];
  phases: QuotePhase[];
  next_steps: QuoteStep[];
  faq: QuoteFaq[];
  legal: string[];
  testimonial: QuoteTestimonial | null;
  discount: QuoteDiscount | null;
  payment: QuotePayment;
  validity_days: number;
  version?: string;
};

/** A short, reasonably-unique id for editor-local list items (upsells, phases, ...). */
export function newId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** A fresh v2 quote content object with sensible, empty defaults for `type`. */
export function emptyQuoteV2(type: QuoteType): QuoteContentV2 {
  return {
    type,
    subtype: undefined,
    platform: type === "website" ? "wordpress" : undefined,
    narrative: "",
    scope: [],
    final_price: 0,
    vat_pct: 18,
    show_breakdown: false,
    upsells: [],
    maintenance: { offer: true, tiers: [] },
    bonuses: [],
    differentiators: [],
    phases: [],
    next_steps: [],
    faq: [],
    legal: [],
    testimonial: null,
    discount: null,
    payment: { deposit_pct: 50 },
    validity_days: 7,
    version: "v1.0",
  };
}

/** Website legal-clause text per platform choice. `applyPlatformClause` swaps
 *  whichever clause is currently in a quote's `legal` snapshot for the one
 *  matching the selected platform, so the client never sees a "platform"
 *  line item , it's baked into the legal wording only. */
export const PLATFORM_CLAUSES: Record<"custom" | "wordpress", string> = {
  wordpress:
    "הפרויקט מתבצע במסגרת וורדפרס + אלמנטור. מערכות נוספות שיידרשו מעבר למוסכם יתומחרו בנפרד. הפלטפורמה המדויקת תיקבע לאחר שיחת האפיון.",
  custom:
    "הפרויקט מפותח בקוד מותאם אישית. מערכות או ספריות נוספות מעבר למוסכם יתומחרו בנפרד. הסטאק המדויק ייקבע לאחר שיחת האפיון.",
};

/** Replaces the first legal clause that mentions WordPress or custom-code
 *  with the clause matching `platform`, leaving every other clause and the
 *  array length untouched. If no clause matches either platform's wording,
 *  the array is returned unchanged (never appended to). Pure function. */
export function applyPlatformClause(legal: string[], platform: "custom" | "wordpress"): string[] {
  const idx = legal.findIndex((c) => c.includes("וורדפרס") || c.includes("קוד מותאם"));
  if (idx === -1) return legal;
  const next = [...legal];
  next[idx] = PLATFORM_CLAUSES[platform];
  return next;
}

/** The client-selectable extras pool: optional scope items + upsells, normalized
 *  to a common shape with their summed subtotal. Used by the builder to show a
 *  reference subtotal and, later, the client pick-list. */
export function optionalExtras(content: QuoteContentV2): {
  items: { id: string; label: string; value: number }[];
  subtotal: number;
} {
  const optionalScope = (content.scope ?? [])
    .filter((it) => it.optional)
    .map((it) => ({ id: it.id, label: it.label, value: Number(it.value) || 0 }));
  const upsells = (content.upsells ?? []).map((u) => ({
    id: u.id,
    label: u.title,
    value: Number(u.price) || 0,
  }));
  const items = [...optionalScope, ...upsells];
  const subtotal = items.reduce((sum, i) => sum + i.value, 0);
  return { items, subtotal };
}

/** Discount amount (₪) for a given pre-discount net, clamped to [0, net]. */
export function discountAmount(net: number, d: QuoteDiscount | null): number {
  if (!d) return 0;
  const base = net || 0;
  const raw = d.mode === "percent" ? (base * (d.value || 0)) / 100 : d.value || 0;
  return Math.min(Math.max(Math.round(raw), 0), Math.round(base));
}

export type QuoteSelected = { upsell_ids: string[]; optional_ids: string[]; maintenance_tier: string | null };

export type QuoteTotals = {
  anchor: number;
  options: PriceOption[];
  chosen: PriceOptionKey | null;
  upsellsTotal: number;
  optionalScopeTotal: number;
  discount: number;
  net: number;
  vat: number;
  total: number;
  split: { deposit: number; rest: number; depositPct: number };
  breakdown: BreakdownLine[];
  monthly: number;
};

/** Composes the pricing engine with a v2 content object + the client's live
 *  selection (chosen upsells, chosen maintenance tier) into every derived
 *  number the quote UI needs to render. Ex-VAT amounts in, VAT-inclusive out.
 *
 *  `monthly` resolves ONLY from the quote's own `content.maintenance.tiers`
 *  snapshot (a tier picked from the admin-curated catalog is copied in at
 *  pick time, so it survives later catalog edits). A selected key with no
 *  matching snapshot resolves to 0 , it never falls back to a live catalog
 *  lookup, which could silently change a sent quote's monthly price out from
 *  under it. `monthlyFor` stays in the signature for back-compat call sites
 *  but is intentionally unused; do not reintroduce it as a price fallback. */
export function quoteTotals(
  content: QuoteContentV2,
  selected: QuoteSelected,
  mult: Multipliers,
  floor: number,
  _monthlyFor: (tier: string) => number,
): QuoteTotals {
  const anchor = anchorValue({
    type: content.type,
    subtype: content.subtype as WebsiteSubtype | undefined,
    items: content.scope,
  });
  const options = priceOptions(anchor, mult, floor);
  const chosen = options.find((o) => o.price === content.final_price)?.key ?? null;

  const selectedIds = new Set(selected.upsell_ids ?? []);
  const upsellsTotal = (content.upsells ?? [])
    .filter((u) => selectedIds.has(u.id))
    .reduce((sum, u) => sum + (Number(u.price) || 0), 0);

  const selectedOptionalIds = new Set(selected.optional_ids ?? []);
  const optionalScopeTotal = (content.scope ?? [])
    .filter((it) => it.optional && !it.free && selectedOptionalIds.has(it.id))
    .reduce((sum, it) => sum + (Number(it.value) || 0), 0);

  const gross = (content.final_price || 0) + upsellsTotal + optionalScopeTotal;
  const discount = discountAmount(gross, content.discount);
  const net = Math.max(0, gross - discount);
  const total = withVat(net, content.vat_pct);
  const vat = total - net;
  const split = paymentSplit(total, content.payment.deposit_pct);
  const breakdown = breakdownForFinal(
    content.scope.filter((i) => !i.optional && !i.free),
    content.final_price,
  );
  const snapshotTier = selected.maintenance_tier
    ? (content.maintenance?.tiers ?? []).find((t) => t.key === selected.maintenance_tier)
    : undefined;
  const monthly = snapshotTier ? snapshotTier.price : 0;

  return {
    anchor,
    options,
    chosen,
    upsellsTotal,
    optionalScopeTotal,
    discount,
    net,
    vat,
    total,
    split,
    breakdown,
    monthly,
  };
}
