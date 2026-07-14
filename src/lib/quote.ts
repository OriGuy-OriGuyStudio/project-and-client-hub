import type { ServiceTier } from "@/lib/service-plans";

export type QuoteSiteType = "landing" | "portfolio" | "store" | "app" | "custom";
export const QUOTE_MULTS = [1, 1.5, 2] as const;

/** One priced line (page or feature): price = base × mult. */
export type QuoteLine = { id: string; name: string; mult: number };
/** A fixed-price add-on the client can toggle on the quote page. */
export type QuoteUpsell = { id: string; title: string; desc?: string; price: number };

/** The full quote structure (source of truth for all pricing). Stored as the
 *  `content` jsonb of a price_quotes row. */
export type QuoteContent = {
  base_project: number;
  base_page: number;
  base_feature: number;
  margin_pct: number; // 10 | 20 | 30
  pages: QuoteLine[];
  features: QuoteLine[];
  upsells: QuoteUpsell[];
  maintenance: { offer: boolean; tiers: ServiceTier[] };
  vat_pct: number; // default 18
  intro?: string; // client-facing opener
  notes?: string; // internal only (stripped from the public RPC)
};

/** What the client picked on the quote page. */
export type QuoteSelected = { upsell_ids: string[]; maintenance_tier: ServiceTier | null };

export const SITE_TYPE_LABEL: Record<QuoteSiteType, string> = {
  landing: "דף נחיתה",
  portfolio: "אתר תדמית",
  store: "חנות / קטלוג",
  app: "אפליקציה",
  custom: "פרויקט מותאם אישית",
};

export function emptyQuoteContent(): QuoteContent {
  return {
    base_project: 1500,
    base_page: 850,
    base_feature: 650,
    margin_pct: 30,
    pages: [],
    features: [],
    upsells: [],
    maintenance: { offer: true, tiers: ["core", "pro", "ultra"] },
    vat_pct: 18,
    intro: "",
    notes: "",
  };
}

export function linePrice(base: number, mult: number): number {
  return Math.round((base || 0) * (mult || 1));
}

export function withVat(amount: number, vatPct: number): number {
  return Math.round(amount * (1 + (vatPct || 0) / 100));
}

export type QuoteTotals = {
  pagesTotal: number;
  featuresTotal: number;
  subtotal: number;
  margin: number;
  oneTimeBase: number; // subtotal + margin, before upsells
  upsellsTotal: number;
  oneTimeTotal: number; // oneTimeBase + selected upsells
  monthly: number; // selected maintenance tier price / month (0 if none)
};

/**
 * Compute all quote totals from the content + (optional) client selections.
 * `monthlyForTier` maps a maintenance tier to its ₪/month price (from
 * service_plan_content / plan-config), so the lib stays free of that dependency.
 */
export function computeQuote(
  c: QuoteContent,
  selected?: QuoteSelected | null,
  monthlyForTier?: (tier: ServiceTier) => number
): QuoteTotals {
  const pagesTotal = (c.pages ?? []).reduce((n, p) => n + linePrice(c.base_page, p.mult), 0);
  const featuresTotal = (c.features ?? []).reduce((n, f) => n + linePrice(c.base_feature, f.mult), 0);
  const subtotal = (c.base_project || 0) + pagesTotal + featuresTotal;
  const margin = Math.round(subtotal * (c.margin_pct || 0) / 100);
  const oneTimeBase = subtotal + margin;

  const chosenIds = new Set(selected?.upsell_ids ?? []);
  const upsellsTotal = (c.upsells ?? [])
    .filter((u) => chosenIds.has(u.id))
    .reduce((n, u) => n + (u.price || 0), 0);

  const tier = selected?.maintenance_tier ?? null;
  const monthly = tier && monthlyForTier ? monthlyForTier(tier) : 0;

  return {
    pagesTotal,
    featuresTotal,
    subtotal,
    margin,
    oneTimeBase,
    upsellsTotal,
    oneTimeTotal: oneTimeBase + upsellsTotal,
    monthly,
  };
}

export function shekel(n: number): string {
  return "₪" + Math.round(n || 0).toLocaleString("he-IL");
}
