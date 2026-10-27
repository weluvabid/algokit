import { describe, expect, it } from "vitest";
import { ConsistentHashing } from "#consistent-hashing";
import fc from "fast-check";

describe("ConsistentHashing", () => {
  it("selects deterministically and supports byte-array keys", () => {
    const ring = new ConsistentHashing({ virtualNodes: 64 });
    ring.addNode("a");
    ring.addNode("b");
    ring.addNode("c");
    expect(ring.getNode("customer-42")).toBe(ring.getNode("customer-42"));
    expect(ring.getNode(new TextEncoder().encode("customer-42"))).toBe(ring.getNode("customer-42"));
  });

  it("returns undefined for an empty ring and handles node lifecycle", () => {
    const ring = new ConsistentHashing();
    expect(ring.getNode("key")).toBeUndefined();
    ring.addNode("a");
    ring.addNode("a");
    expect(ring.size).toBe(1);
    expect(ring.removeNode("missing")).toBe(false);
    expect(ring.removeNode("a")).toBe(true);
    expect(ring.getNode("key")).toBeUndefined();
  });

  it("preserves assignments not owned by a removed node", () => {
    const ring = new ConsistentHashing({ virtualNodes: 128 });
    ["a", "b", "c"].forEach((node) => ring.addNode(node));
    const before = new Map(
      Array.from({ length: 500 }, (_, i) => `key-${i}`).map((key) => [key, ring.getNode(key)]),
    );
    ring.removeNode("b");
    for (const [key, oldNode] of before) {
      const nextNode = ring.getNode(key);
      if (oldNode !== "b") expect(nextNode).toBe(oldNode);
      else expect(nextNode).not.toBe("b");
    }
  });

  it("validates virtual node count and emits trace events", () => {
    expect(() => new ConsistentHashing({ virtualNodes: 0 })).toThrow(RangeError);
    const events: unknown[] = [];
    const ring = new ConsistentHashing({ onTrace: (event) => events.push(event) });
    ring.addNode("node-a");
    ring.removeNode("node-a");
    expect(events).toHaveLength(2);
  });

  it("is deterministic across equivalent insertion orders", () => {
    const first = new ConsistentHashing({ virtualNodes: 64 });
    const second = new ConsistentHashing({ virtualNodes: 64 });
    ["a", "b", "c", "d"].forEach((node) => first.addNode(node));
    ["d", "b", "a", "c"].forEach((node) => second.addNode(node));
    for (let index = 0; index < 300; index++) {
      const key = `key-${index}`;
      expect(first.getNode(key)).toBe(second.getNode(key));
    }
  });

  it("assigns a deterministic key set across the configured nodes", () => {
    const ring = new ConsistentHashing({ virtualNodes: 128 });
    const nodes = ["a", "b", "c", "d"];
    nodes.forEach((node) => ring.addNode(node));
    const counts = new Map(nodes.map((node) => [node, 0]));
    for (let index = 0; index < 4_000; index++) {
      const node = ring.getNode(`distribution-key-${index}`);
      expect(node).toBeDefined();
      counts.set(node!, counts.get(node!)! + 1);
    }
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(500);
      expect(count).toBeLessThan(1_500);
    }
  });

  it("does not change node membership after repeated duplicate additions", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string({ minLength: 1 }), { maxLength: 20 }), (nodes) => {
        const ring = new ConsistentHashing({ virtualNodes: 8 });
        nodes.forEach((node) => {
          ring.addNode(node);
          ring.addNode(node);
        });
        expect(ring.size).toBe(nodes.length);
        expect(ring.nodes()).toEqual([...nodes].sort());
      }),
    );
  });
});
