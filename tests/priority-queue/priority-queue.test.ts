import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { PriorityQueue } from "#priority-queue";

describe("PriorityQueue", () => {
  it("pops values in comparator order", () => {
    const values = [7, 1, 9, -2, 4, 4, 0];
    const queue = new PriorityQueue<number>((a, b) => a - b);
    values.forEach((value) => queue.push(value));
    expect(Array.from({ length: values.length }, () => queue.pop())).toEqual([...values].sort((a, b) => a - b));
    expect(queue.pop()).toBeUndefined();
  });

  it("matches sorted-array behavior for arbitrary integer sequences", () => {
    fc.assert(fc.property(fc.array(fc.integer()), (values) => {
      const queue = new PriorityQueue<number>((a, b) => a - b);
      values.forEach((value) => queue.push(value));
      expect(Array.from({ length: values.length }, () => queue.pop())).toEqual([...values].sort((a, b) => a - b));
    }));
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
});
