import { describe, expect, it } from "vitest";
import { ConsistentHashing } from "#consistent-hashing";

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
});
