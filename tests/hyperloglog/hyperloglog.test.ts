import { describe, expect, it } from "vitest";
import { HyperLogLog } from "#hyperloglog";
import fc from "fast-check";

describe("HyperLogLog", () => {
  it("estimates cardinality and ignores duplicate values", () => {
    const hll = new HyperLogLog({ precision: 12 });
    for (let index = 0; index < 10_000; index++) hll.add(`item-${index}`);
    const estimate = hll.estimate();
    expect(estimate).toBeGreaterThan(8_500);
    expect(estimate).toBeLessThan(11_500);
    for (let index = 0; index < 10_000; index++) hll.add(`item-${index}`);
    expect(hll.estimate()).toBeGreaterThan(8_500);
    expect(hll.estimate()).toBeLessThan(11_500);
  });

  it("supports byte arrays", () => {
    const hll = new HyperLogLog({ precision: 8 });
    hll.add(new Uint8Array([1, 2, 3]));
    expect(hll.estimate()).toBeGreaterThan(0);
  });

  it("validates precision", () => {
    expect(() => new HyperLogLog({ precision: 3 })).toThrow(RangeError);
    expect(() => new HyperLogLog({ precision: 17 })).toThrow(RangeError);
  });

  it("handles hashes whose register remainder has leading zero words", () => {
    for (const precision of [4, 8, 12, 16]) {
      const hll = new HyperLogLog({ precision });
      for (let index = 0; index < 2_000; index++) hll.add(`leading-zero-case-${index}`);
      expect(Number.isFinite(hll.estimate())).toBe(true);
      expect(hll.estimate()).toBeGreaterThan(0);
    }
  });

  it("is deterministic and insensitive to repeated values", () => {
    const first = new HyperLogLog({ precision: 10 });
    const second = new HyperLogLog({ precision: 10 });
    for (let index = 0; index < 2_000; index++) {
      first.add(`value-${index}`);
      second.add(`value-${index}`);
      second.add(`value-${index}`);
    }
    expect(first.estimate()).toBe(second.estimate());
  });

  it("estimates several deterministic cardinalities within broad bounds", () => {
    for (const cardinality of [1, 10, 50, 250, 1_000, 5_000]) {
      const hll = new HyperLogLog({ precision: 10 });
      for (let index = 0; index < cardinality; index++) hll.add(`cardinality-${index}`);
      const estimate = hll.estimate();
      expect(estimate).toBeGreaterThanOrEqual(0);
      expect(estimate).toBeGreaterThan(cardinality * 0.65);
      expect(estimate).toBeLessThan(cardinality * 1.35 + 2);
    }
  });

  it("is deterministic for arbitrary generated strings", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string(), { maxLength: 200 }), (values) => {
        const first = new HyperLogLog({ precision: 8 });
        const second = new HyperLogLog({ precision: 8 });
        values.forEach((value) => {
          first.add(value);
          second.add(value);
        });
        expect(first.estimate()).toBe(second.estimate());
      }),
    );
  });
});
