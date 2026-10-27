import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { OrderedTree } from "#ordered-tree";

const compare = (a: number, b: number): number => a - b;

describe("OrderedTree", () => {
  it("keeps unique keys in sorted order and supports rank/select", () => {
    const tree = new OrderedTree(compare);
    for (const value of [8, 3, 10, 1, 6, 14, 4, 7, 13]) expect(tree.insert(value)).toBe(true);
    expect(tree.insert(6)).toBe(false);
    expect([...tree]).toEqual([1, 3, 4, 6, 7, 8, 10, 13, 14]);
    expect(tree.size).toBe(9);
    expect(tree.min()).toBe(1);
    expect(tree.max()).toBe(14);
    expect(tree.rank(0)).toBe(0);
    expect(tree.rank(6)).toBe(3);
    expect(tree.rank(9)).toBe(6);
    expect(tree.rank(20)).toBe(9);
    expect(Array.from({ length: tree.size }, (_, index) => tree.select(index))).toEqual([...tree]);
    expect(tree.select(-1)).toBeUndefined();
    expect(tree.select(9)).toBeUndefined();
  });

  it("deletes leaves, internal nodes, roots, and missing keys", () => {
    const tree = new OrderedTree(compare);
    const values = [41, 38, 31, 12, 19, 8, 50, 60, 55, 1, 2, 3, 4, 5];
    const model = new Set(values);
    values.forEach((value) => tree.insert(value));
    for (const value of [8, 41, 31, 38, 1, 60, 19, 12, 55, 50, 2, 3, 4, 5]) {
      expect(tree.delete(value)).toBe(model.delete(value));
      expect(tree.has(value)).toBe(false);
      expect([...tree]).toEqual([...model].sort(compare));
    }
    expect(tree.isEmpty).toBe(true);
    expect(tree.delete(123)).toBe(false);
    expect(tree.select(0)).toBeUndefined();
  });

  it("matches a sorted set under arbitrary insert/delete sequences", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.boolean(), fc.integer({ min: -100, max: 100 }))),
        (operations) => {
          const tree = new OrderedTree(compare);
          const model = new Set<number>();
          for (const [insert, value] of operations) {
            if (insert) {
              expect(tree.insert(value)).toBe(!model.has(value));
              model.add(value);
            } else {
              expect(tree.delete(value)).toBe(model.delete(value));
            }
            const sorted = [...model].sort(compare);
            expect([...tree]).toEqual(sorted);
            expect(tree.size).toBe(sorted.length);
            expect(Array.from({ length: sorted.length }, (_, index) => tree.select(index))).toEqual(
              sorted,
            );
            for (const probe of [-101, -50, 0, 50, 101]) {
              expect(tree.rank(probe)).toBe(sorted.filter((entry) => entry < probe).length);
            }
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it("clears all nodes", () => {
    const tree = new OrderedTree(compare);
    [1, 2, 3].forEach((value) => tree.insert(value));
    tree.clear();
    expect(tree.size).toBe(0);
    expect([...tree]).toEqual([]);
  });
});
