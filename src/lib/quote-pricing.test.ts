import { describe, it, expect } from "vitest";
import { anchorValue, type QuoteScope } from "./quote-pricing";

const scope: QuoteScope = {
  type: "website",
  subtype: "portfolio",
  items: [
    { id: "s", kind: "subtype", label: "תדמית", value: 4000 },
    { id: "p1", kind: "page", label: "בית", value: 2500 },
    { id: "f1", kind: "feature", label: "CMS", value: 1500 },
  ],
};

describe("anchorValue", () => {
  it("sums item values", () => { expect(anchorValue(scope)).toBe(8000); });
  it("is 0 for empty scope", () => {
    expect(anchorValue({ type: "website", items: [] })).toBe(0);
  });
  it("excludes optional items", () => {
    const items = [
      { id: "a", kind: "page", label: "בית", value: 2500 },
      { id: "b", kind: "feature", label: "בלוג", value: 1800, optional: true },
    ] as const;
    expect(anchorValue({ type: "website", items: [...items] })).toBe(2500);
  });
  it("with all included unchanged", () => {
    const items = [{ id: "a", kind: "page", label: "בית", value: 2500 }] as const;
    expect(anchorValue({ type: "website", items: [...items] })).toBe(2500);
  });
});

import { priceOptions, belowFloor, DEFAULT_MULTIPLIERS } from "./quote-pricing";

describe("priceOptions", () => {
  it("computes fair/recommended/premium from anchor", () => {
    const o = priceOptions(10000, DEFAULT_MULTIPLIERS, 4500);
    expect(o.map((x) => x.price)).toEqual([10000, 12500, 15000]);
    expect(o.map((x) => x.key)).toEqual(["fair", "recommended", "premium"]);
    expect(o[1].rationale.length).toBeGreaterThan(10);
  });
  it("floors every option at the premium floor", () => {
    const o = priceOptions(3000, DEFAULT_MULTIPLIERS, 4500);
    expect(o.map((x) => x.price)).toEqual([4500, 4500, 4500]);
  });
  it("rounds to whole shekels", () => {
    const o = priceOptions(3333, { fair: 1, recommended: 1.25, premium: 1.5 }, 0);
    expect(o[1].price).toBe(4166);
  });
});

describe("belowFloor", () => {
  it("flags a manual price under the floor", () => {
    expect(belowFloor(4000, 4500)).toBe(true);
    expect(belowFloor(5000, 4500)).toBe(false);
  });
});

import { breakdownForFinal } from "./quote-pricing";

const items = [
  { id: "a", kind: "page" as const, label: "בית", value: 4500 },
  { id: "b", kind: "page" as const, label: "אודות", value: 3000 },
  { id: "c", kind: "feature" as const, label: "CMS", value: 2500 },
];

describe("breakdownForFinal", () => {
  it("returns raw values when final equals the sum", () => {
    const b = breakdownForFinal(items, 10000);
    expect(b.map((x) => x.price)).toEqual([4500, 3000, 2500]);
  });
  it("scales proportionally and sums EXACTLY to final", () => {
    const b = breakdownForFinal(items, 13333);
    expect(b.reduce((s, x) => s + x.price, 0)).toBe(13333);
  });
  it("handles zero total without dividing by zero", () => {
    const b = breakdownForFinal([{ id: "z", kind: "page", label: "x", value: 0 }], 5000);
    expect(b[0].price).toBe(5000);
  });
});

import { withVat, vatOf, paymentSplit, shekel } from "./quote-pricing";

describe("vat + payment", () => {
  it("adds VAT", () => { expect(withVat(10000, 18)).toBe(11800); });
  it("returns VAT amount", () => { expect(vatOf(10000, 18)).toBe(1800); });
  it("splits by deposit pct, rest = total - deposit", () => {
    const s = paymentSplit(11800, 50);
    expect(s.deposit).toBe(5900);
    expect(s.rest).toBe(5900);
    expect(s.deposit + s.rest).toBe(11800);
  });
  it("formats shekels he-IL", () => { expect(shekel(11800)).toBe("₪11,800"); });
});
