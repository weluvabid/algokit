import { describe, expect, it } from "vitest";
import { BloomFilter } from "#bloom-filter";

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
});
