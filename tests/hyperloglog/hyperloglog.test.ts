import { describe, expect, it } from "vitest";
import { HyperLogLog } from "#hyperloglog";

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
});
