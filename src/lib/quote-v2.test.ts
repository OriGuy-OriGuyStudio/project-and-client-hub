import { describe, it, expect } from "vitest";
import { DEFAULT_MULTIPLIERS, priceOptions, withVat, paymentSplit, type ScopeItem } from "./quote-pricing";
import { TIER_META, type ServiceTier } from "./service-plans";
import {
  emptyQuoteV2,
  newId,
  discountAmount,
  quoteTotals,
  optionalExtras,
  applyPlatformClause,
  PLATFORM_CLAUSES,
  type QuoteContentV2,
  type QuoteSelected,
  type MaintenanceTierSnapshot,
} from "./quote-v2";

const scope: ScopeItem[] = [
  { id: "s", kind: "subtype", label: "דף נחיתה", value: 2500 },
  { id: "p1", kind: "page", label: "בית", value: 2500 },
  { id: "f1", kind: "feature", label: "CMS", value: 1500 },
];
// anchor = 6500

function baseContent(overrides: Partial<QuoteContentV2> = {}): QuoteContentV2 {
  return {
    ...emptyQuoteV2("website"),
    scope,
    final_price: 6500,
    upsells: [
      { id: "u1", title: "SEO בסיסי", price: 800 },
      { id: "u2", title: "כתיבת תוכן", price: 1200 },
    ],
    ...overrides,
  };
}

const noneSelected: QuoteSelected = { upsell_ids: [], maintenance_tier: null };

describe("emptyQuoteV2", () => {
  it("sets sensible defaults", () => {
    const c = emptyQuoteV2("system");
    expect(c.type).toBe("system");
    expect(c.vat_pct).toBe(18);
    expect(c.show_breakdown).toBe(false);
    expect(c.scope).toEqual([]);
    expect(c.upsells).toEqual([]);
    expect(c.maintenance).toEqual({ offer: true, tiers: [] });
    expect(c.payment).toEqual({ deposit_pct: 50 });
    expect(c.validity_days).toBe(7);
    expect(c.final_price).toBe(0);
    expect(c.discount).toBeNull();
    expect(c.version).toBe("v1.0");
  });

  it("defaults narrative to an empty string", () => {
    expect(emptyQuoteV2("website").narrative).toBe("");
  });
});

describe("applyPlatformClause", () => {
  const wordpressLegal = [
    "אחריות של 30 יום.",
    PLATFORM_CLAUSES.wordpress,
    "התשלום מתבצע לפי לוח התשלומים.",
  ];

  it("swaps the wordpress clause for the custom clause, leaving other clauses and length untouched", () => {
    const result = applyPlatformClause(wordpressLegal, "custom");
    expect(result).toHaveLength(wordpressLegal.length);
    expect(result[1]).toBe(PLATFORM_CLAUSES.custom);
    expect(result[0]).toBe(wordpressLegal[0]);
    expect(result[2]).toBe(wordpressLegal[2]);
  });

  it("swaps back from custom to wordpress", () => {
    const customLegal = applyPlatformClause(wordpressLegal, "custom");
    const backToWordpress = applyPlatformClause(customLegal, "wordpress");
    expect(backToWordpress[1]).toBe(PLATFORM_CLAUSES.wordpress);
  });

  it("returns the array unchanged when no clause matches either platform", () => {
    const legal = ["אחריות של 30 יום.", "התשלום מתבצע לפי לוח התשלומים."];
    const result = applyPlatformClause(legal, "custom");
    expect(result).toEqual(legal);
  });
});

describe("newId", () => {
  it("returns unique ids on repeated calls", () => {
    const a = newId("u");
    const b = newId("u");
    expect(a).not.toBe(b);
  });
  it("uses the given prefix", () => {
    expect(newId("upsell").startsWith("upsell")).toBe(true);
  });
});

describe("discountAmount", () => {
  it("is 0 when there is no discount", () => {
    expect(discountAmount(10000, null)).toBe(0);
  });
  it("computes a percent discount", () => {
    expect(discountAmount(10000, { mode: "percent", value: 10 })).toBe(1000);
  });
  it("computes a fixed amount discount", () => {
    expect(discountAmount(10000, { mode: "amount", value: 1500 })).toBe(1500);
  });
  it("clamps a discount larger than net to net", () => {
    expect(discountAmount(1000, { mode: "amount", value: 5000 })).toBe(1000);
  });
  it("clamps a negative discount to 0", () => {
    expect(discountAmount(1000, { mode: "amount", value: -500 })).toBe(0);
  });
});

describe("optionalExtras", () => {
  it("sums optional scope + upsells", () => {
    const c = {
      ...emptyQuoteV2("website"),
      scope: [
        { id: "a", kind: "page", label: "בית", value: 2500 },
        { id: "b", kind: "feature", label: "בלוג", value: 1800, optional: true },
      ],
      upsells: [{ id: "u1", title: "רב-לשוני", price: 1800 }],
    } as QuoteContentV2;
    const r = optionalExtras(c);
    expect(r.subtotal).toBe(3600);
    expect(r.items.map((i) => i.id).sort()).toEqual(["b", "u1"]);
  });
});

describe("quoteTotals", () => {
  const mult = DEFAULT_MULTIPLIERS;
  const floor = 4500;
  const monthlyFor = (t: string) => TIER_META[t as ServiceTier].price;

  it("computes the anchor from the scope items", () => {
    const r = quoteTotals(baseContent(), noneSelected, mult, floor, monthlyFor);
    expect(r.anchor).toBe(6500);
  });

  it("options match priceOptions(anchor, mult, floor)", () => {
    const r = quoteTotals(baseContent(), noneSelected, mult, floor, monthlyFor);
    expect(r.options).toEqual(priceOptions(6500, mult, floor));
  });

  it("with nothing selected, net equals final_price and total adds VAT", () => {
    const r = quoteTotals(baseContent(), noneSelected, mult, floor, monthlyFor);
    expect(r.upsellsTotal).toBe(0);
    expect(r.net).toBe(6500);
    expect(r.total).toBe(withVat(6500, 18));
    expect(r.vat).toBe(withVat(6500, 18) - 6500);
  });

  it("a selected upsell adds to net and total", () => {
    const selected: QuoteSelected = { upsell_ids: ["u1"], maintenance_tier: null };
    const r = quoteTotals(baseContent(), selected, mult, floor, monthlyFor);
    expect(r.upsellsTotal).toBe(800);
    expect(r.net).toBe(7300);
    expect(r.total).toBe(withVat(7300, 18));
  });

  it("multiple selected upsells sum together", () => {
    const selected: QuoteSelected = { upsell_ids: ["u1", "u2"], maintenance_tier: null };
    const r = quoteTotals(baseContent(), selected, mult, floor, monthlyFor);
    expect(r.upsellsTotal).toBe(2000);
    expect(r.net).toBe(8500);
  });

  it("breakdown sums exactly to final_price, even with rounding", () => {
    const r = quoteTotals(baseContent({ final_price: 7123 }), noneSelected, mult, floor, monthlyFor);
    expect(r.breakdown.reduce((s, l) => s + l.price, 0)).toBe(7123);
  });

  it("breakdown excludes optional scope items", () => {
    const optionalScope: ScopeItem[] = [
      { id: "inc1", kind: "page", label: "בית", value: 2500 },
      { id: "opt1", kind: "feature", label: "בלוג", value: 1800, optional: true },
    ];
    const r = quoteTotals(
      baseContent({ scope: optionalScope, final_price: 2500 }),
      noneSelected,
      mult,
      floor,
      monthlyFor,
    );
    expect(r.breakdown.length).toBe(1);
    expect(r.breakdown.reduce((s, l) => s + l.price, 0)).toBe(2500);
  });

  it("a percent discount reduces net (applied on final_price + upsells)", () => {
    const r = quoteTotals(
      baseContent({ discount: { mode: "percent", value: 10 } }),
      noneSelected,
      mult,
      floor,
      monthlyFor,
    );
    expect(r.discount).toBe(650);
    expect(r.net).toBe(5850);
  });

  it("discount applies after upsells are added", () => {
    const selected: QuoteSelected = { upsell_ids: ["u1"], maintenance_tier: null };
    const r = quoteTotals(
      baseContent({ discount: { mode: "percent", value: 10 } }),
      selected,
      mult,
      floor,
      monthlyFor,
    );
    // (6500 + 800) * 0.9 = 6570
    expect(r.discount).toBe(730);
    expect(r.net).toBe(6570);
  });

  it("selecting a maintenance tier with no matching snapshot resolves monthly to 0 (never falls back to a live catalog lookup)", () => {
    const selected: QuoteSelected = { upsell_ids: [], maintenance_tier: "pro" };
    const r = quoteTotals(baseContent(), selected, mult, floor, monthlyFor);
    expect(r.monthly).toBe(0);
  });

  it("no maintenance tier selected means monthly is 0", () => {
    const r = quoteTotals(baseContent(), noneSelected, mult, floor, monthlyFor);
    expect(r.monthly).toBe(0);
  });

  it("selecting a maintenance tier resolves its price from the content snapshot", () => {
    const tiers: MaintenanceTierSnapshot[] = [{ key: "pro", name: "Pro", price: 850 }];
    const content = baseContent({ maintenance: { offer: true, tiers } });
    const selected: QuoteSelected = { upsell_ids: [], maintenance_tier: "pro" };
    const r = quoteTotals(content, selected, mult, floor, monthlyFor);
    expect(r.monthly).toBe(850);
  });

  it("the snapshot price wins over monthlyFor when both could resolve the key", () => {
    const tiers: MaintenanceTierSnapshot[] = [{ key: "pro", name: "Pro", price: 850 }];
    const content = baseContent({ maintenance: { offer: true, tiers } });
    const selected: QuoteSelected = { upsell_ids: [], maintenance_tier: "pro" };
    const r = quoteTotals(content, selected, mult, floor, monthlyFor);
    expect(r.monthly).not.toBe(TIER_META.pro.price);
    expect(r.monthly).toBe(850);
  });

  it("split reconciles exactly to total", () => {
    const r = quoteTotals(baseContent(), noneSelected, mult, floor, monthlyFor);
    expect(r.split).toEqual(paymentSplit(r.total, 50));
    expect(r.split.deposit + r.split.rest).toBe(r.total);
  });

  it("chosen is 'recommended' when final_price matches the recommended option's price", () => {
    // anchor 6500 * recommended mult 1.25 = 8125
    const r = quoteTotals(baseContent({ final_price: 8125 }), noneSelected, mult, floor, monthlyFor);
    const recommended = r.options.find((o) => o.key === "recommended");
    expect(recommended?.price).toBe(8125);
    expect(r.chosen).toBe("recommended");
  });

  it("chosen is null when final_price matches none of the suggested prices (manual override)", () => {
    const r = quoteTotals(baseContent({ final_price: 7000 }), noneSelected, mult, floor, monthlyFor);
    expect(r.options.some((o) => o.price === 7000)).toBe(false);
    expect(r.chosen).toBeNull();
  });
});
