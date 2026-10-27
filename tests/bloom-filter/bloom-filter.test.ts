import { describe, expect, it } from "vitest";
import { BloomFilter } from "#bloom-filter";
import fc from "fast-check";

describe("BloomFilter", () => {
  it("never loses inserted values", () => {
    const filter = new BloomFilter({ expectedItems: 100, falsePositiveRate: 0.01 });
    const values = Array.from({ length: 100 }, (_, index) => `item-${index}`);
    values.forEach((value) => filter.add(value));
    values.forEach((value) => expect(filter.has(value)).toBe(true));
    expect(filter.size).toBe(100);
  });

  it("supports byte arrays and deterministic membership", () => {
    const filter = new BloomFilter({ expectedItems: 10, falsePositiveRate: 0.05 });
    filter.add(new Uint8Array([1, 2, 3]));
    expect(filter.has(new Uint8Array([1, 2, 3]))).toBe(true);
    expect(filter.has(new Uint8Array([1, 2, 3]))).toBe(true);
  });

  it("validates sizing parameters", () => {
    expect(() => new BloomFilter({ expectedItems: 0, falsePositiveRate: 0.01 })).toThrow(
      RangeError,
    );
    expect(() => new BloomFilter({ expectedItems: 10, falsePositiveRate: 1 })).toThrow(RangeError);
  });

  it("never reports inserted arbitrary strings as absent", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string(), { maxLength: 100 }), (values) => {
        const filter = new BloomFilter({
          expectedItems: Math.max(1, values.length),
          falsePositiveRate: 0.01,
        });
        values.forEach((value) => filter.add(value));

        for (const value of values) expect(filter.has(value)).toBe(true);
      }),
    );
  });

  it("keeps repeated additions distinct from bit occupancy", () => {
    const filter = new BloomFilter({ expectedItems: 100, falsePositiveRate: 0.01 });
    const events: { type: "add"; bitsSet: number }[] = [];
    const traced = new BloomFilter({
      expectedItems: 100,
      falsePositiveRate: 0.01,
      onTrace: (event) => events.push(event),
    });

    filter.add("same");
    const occupiedAfterFirst = filter.bitCountSet;
    filter.add("same");
    expect(filter.bitCountSet).toBe(occupiedAfterFirst);
    expect(filter.size).toBe(2);

    traced.add("same");
    traced.add("same");
    expect(events).toHaveLength(2);
    expect(events[1]?.bitsSet).toBe(events[0]?.bitsSet);
  });

  it("tracks newly occupied bits exactly across overlapping insertions", () => {
    const filter = new BloomFilter({ expectedItems: 20, falsePositiveRate: 0.1 });
    filter.add("alpha");
    const firstCount = filter.bitCountSet;
    expect(firstCount).toBeGreaterThan(0);
    expect(firstCount).toBeLessThanOrEqual(filter.hashCount);

    filter.add("alpha");
    expect(filter.bitCountSet).toBe(firstCount);

    filter.add("beta");
    expect(filter.bitCountSet).toBeGreaterThanOrEqual(firstCount);
    expect(filter.bitCountSet).toBeLessThanOrEqual(filter.bitCount);
  });

  it("handles empty, Unicode, and delimiter-like strings", () => {
    const filter = new BloomFilter({ expectedItems: 8, falsePositiveRate: 0.01 });
    const values = ["", "café", "🧪", "\\0", "a|b", "a:b"];
    values.forEach((value) => filter.add(value));
    values.forEach((value) => expect(filter.has(value)).toBe(true));
  });

  it("keeps observed false positives within a broad deterministic smoke-test bound", () => {
    const filter = new BloomFilter({ expectedItems: 500, falsePositiveRate: 0.02 });

    for (let index = 0; index < 500; index++) filter.add(`inserted-${index}`);

    let falsePositives = 0;

    for (let index = 0; index < 2_000; index++) {
      if (filter.has(`not-inserted-${index}`)) falsePositives++;
    }

    expect(falsePositives).toBeLessThan(160);
  });
});
