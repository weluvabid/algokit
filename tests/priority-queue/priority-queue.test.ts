import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { PriorityQueue } from "#priority-queue";

describe("PriorityQueue", () => {
  it("pops values in comparator order", () => {
    const values = [7, 1, 9, -2, 4, 4, 0];
    const queue = new PriorityQueue<number>((a, b) => a - b);
    values.forEach((value) => queue.push(value));
    expect(Array.from({ length: values.length }, () => queue.pop())).toEqual(
      [...values].sort((a, b) => a - b),
    );
    expect(queue.pop()).toBeUndefined();
  });

  it("matches sorted-array behavior for arbitrary integer sequences", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (values) => {
        const queue = new PriorityQueue<number>((a, b) => a - b);
        values.forEach((value) => queue.push(value));
        expect(Array.from({ length: values.length }, () => queue.pop())).toEqual(
          [...values].sort((a, b) => a - b),
        );
      }),
    );
  });

  it("handles empty and singleton queues", () => {
    const queue = new PriorityQueue<number>((a, b) => a - b);
    expect(queue.peek()).toBeUndefined();
    expect(queue.pop()).toBeUndefined();
    queue.push(3);
    expect(queue.peek()).toBe(3);
    expect(queue.pop()).toBe(3);
    expect(queue.isEmpty).toBe(true);
  });

  it("matches a sorted-array model across interleaved pushes and pops", () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { maxLength: 300 }), (values) => {
        const queue = new PriorityQueue<number>((a, b) => a - b);
        const model: number[] = [];

        values.forEach((value, index) => {
          queue.push(value);
          model.push(value);
          model.sort((a, b) => a - b);
          if (index % 3 === 2) {
            expect(queue.pop()).toBe(model.shift());
          }
          expect(queue.peek()).toBe(model[0]);
          expect(queue.size).toBe(model.length);
        });

        while (model.length > 0) expect(queue.pop()).toBe(model.shift());
        expect(queue.isEmpty).toBe(true);
        expect(queue.pop()).toBeUndefined();
      }),
    );
  });

  it("supports reverse ordering and object comparators", () => {
    const descending = new PriorityQueue<number>((a, b) => b - a);
    [2, 9, -1, 9, 4].forEach((value) => descending.push(value));
    expect(Array.from({ length: 5 }, () => descending.pop())).toEqual([9, 9, 4, 2, -1]);

    const objects = new PriorityQueue<{ priority: number; id: string }>(
      (a, b) => a.priority - b.priority,
    );
    objects.push({ priority: 3, id: "c" });
    objects.push({ priority: 1, id: "a" });
    objects.push({ priority: 2, id: "b" });
    expect([objects.pop()?.id, objects.pop()?.id, objects.pop()?.id]).toEqual(["a", "b", "c"]);
  });
});
