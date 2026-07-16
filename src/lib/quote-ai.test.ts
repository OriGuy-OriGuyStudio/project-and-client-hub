import { describe, it, expect } from "vitest";
import { filterAiIds } from "./quote-ai";

describe("filterAiIds", () => {
  it("drops ids not present in the valid set", () => {
    expect(filterAiIds(["a", "x", "b"], new Set(["a", "b", "c"]))).toEqual(["a", "b"]);
  });

  it("accepts a plain array as the valid-id source", () => {
    expect(filterAiIds(["a", "x", "b"], ["a", "b", "c"])).toEqual(["a", "b"]);
  });

  it("dedupes repeated ids, keeping the first occurrence", () => {
    expect(filterAiIds(["a", "b", "a", "b", "a"], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("preserves the input order, not the valid-set order", () => {
    expect(filterAiIds(["c", "a", "b"], new Set(["a", "b", "c"]))).toEqual(["c", "a", "b"]);
  });

  it("returns an empty array for empty input", () => {
    expect(filterAiIds([], new Set(["a", "b"]))).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterAiIds(["x", "y"], new Set(["a", "b"]))).toEqual([]);
  });

  it("returns an empty array when the valid set is empty", () => {
    expect(filterAiIds(["a", "b"], new Set())).toEqual([]);
  });
});
