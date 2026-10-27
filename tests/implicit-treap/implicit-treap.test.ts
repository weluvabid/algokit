import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { ImplicitTreap } from "#implicit-treap";

describe("ImplicitTreap", () => {
  it("supports indexed sequence operations", () => {
    const treap = new ImplicitTreap([10, 20, 30], { seed: 42 });
    treap.insert(1, 15);
    expect(treap.toArray()).toEqual([10, 15, 20, 30]);
    expect(treap.get(2)).toBe(20);
    expect(treap.set(2, 21)).toBe(20);
    expect(treap.remove(1)).toBe(15);
    expect(treap.toArray()).toEqual([10, 21, 30]);
    treap.push(40);
    expect([...treap]).toEqual([10, 21, 30, 40]);
  });

  it("matches array behavior under arbitrary operations", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 3 }), fc.integer({ min: -100, max: 100 })), {
          maxLength: 250,
        }),
        (operations) => {
          const treap = new ImplicitTreap<number>([], { seed: 12345 });
          const model: number[] = [];
          for (const [operation, value] of operations) {
            if (operation === 0 || model.length === 0) {
              const index = Math.abs(value) % (model.length + 1);
              treap.insert(index, value);
              model.splice(index, 0, value);
            } else if (operation === 1) {
              const index = Math.abs(value) % model.length;
              expect(treap.remove(index)).toBe(model.splice(index, 1)[0]);
            } else if (operation === 2) {
              const index = Math.abs(value) % model.length;
              expect(treap.set(index, value)).toBe(model[index]);
              model[index] = value;
            } else {
              const index = Math.abs(value) % model.length;
              expect(treap.get(index)).toBe(model[index]);
            }
            expect(treap.toArray()).toEqual(model);
            expect(treap.size).toBe(model.length);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("validates indices and handles empty sequences", () => {
    const treap = new ImplicitTreap<number>();
    expect(treap.get(0)).toBeUndefined();
    expect(treap.isEmpty).toBe(true);
    expect(() => treap.remove(0)).toThrow(RangeError);
    expect(() => treap.set(0, 1)).toThrow(RangeError);
    expect(() => treap.insert(1, 1)).toThrow(RangeError);
    expect(() => treap.insert(-1, 1)).toThrow(RangeError);
    expect(() => treap.insert(0.5, 1)).toThrow(RangeError);
  });

  it("is deterministic for the same seed", () => {
    const first = new ImplicitTreap([1, 2, 3, 4, 5], { seed: 7 });
    const second = new ImplicitTreap([1, 2, 3, 4, 5], { seed: 7 });
    [0, 3, 2, 1].forEach((index) => {
      first.remove(index);
      second.remove(index);
    });

    expect(first.toArray()).toEqual(second.toArray());
  });
});
