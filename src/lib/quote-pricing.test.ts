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
