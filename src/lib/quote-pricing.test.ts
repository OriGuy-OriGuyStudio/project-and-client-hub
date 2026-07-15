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
