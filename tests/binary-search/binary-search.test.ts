import { describe, expect, it } from "vitest";
import { binarySearch, lowerBound, upperBound } from "#binary-search";

const compare = (a: number, b: number): number => a - b;

describe("binary search", () => {
  it("finds present values and encodes insertion points for misses", () => {
    const values = [1, 3, 5, 7, 9];
    expect(binarySearch(values, 5, { compare })).toBe(2);
    expect(binarySearch(values, 4, { compare })).toBe(-3);
    expect(binarySearch([], 4, { compare })).toBe(-1);
  });

  it("supports lower and upper bounds with duplicates", () => {
    const values = [1, 2, 2, 2, 4];
    expect(lowerBound(values, 2, compare)).toBe(1);
    expect(upperBound(values, 2, compare)).toBe(4);
    expect(lowerBound(values, 3, compare)).toBe(4);
    expect(upperBound(values, 3, compare)).toBe(4);
  });

  it("handles object values with a comparator", () => {
    const values = [{ id: 1 }, { id: 4 }, { id: 8 }];
    expect(binarySearch(values, { id: 4 }, { compare: (a, b) => a.id - b.id })).toBe(1);
  });

  it("emits probe and result trace events", () => {
    const events: string[] = [];
    binarySearch([1, 3, 5], 4, {
      compare,
      onTrace: (event) => events.push(event.type),
    });
    expect(events).toContain("probe");
    expect(events.at(-1)).toBe("miss");
  });
});
