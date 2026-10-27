import { describe, expect, it } from "vitest";
import { RendezvousHashing } from "#rendezvous-hashing";

describe("RendezvousHashing", () => {
  const hashing = new RendezvousHashing();

  it("selects deterministically and ranks nodes by score", () => {
    const nodes = ["node-a", "node-b", "node-c"];
    expect(hashing.getNode("customer-42", nodes)).toBe(hashing.getNode("customer-42", nodes));
    expect(hashing.getNode("customer-42", nodes)).toBe(hashing.rank("customer-42", nodes)[0]);
  });

  it("returns undefined for an empty node set", () => {
    expect(hashing.getNode("key", [])).toBeUndefined();
    expect(hashing.rank("key", [])).toEqual([]);
  });

  it("adding a node only changes keys that select the new node", () => {
    const original = ["node-a", "node-b", "node-c"];
    const expanded = [...original, "node-d"];
    for (let index = 0; index < 500; index++) {
      const key = `key-${index}`;
      const before = hashing.getNode(key, original);
      const after = hashing.getNode(key, expanded);
      expect(after === before || after === "node-d").toBe(true);
    }
  });

  it("deduplicates ranking nodes and validates empty names", () => {
    expect(hashing.rank("key", ["a", "a", "b"])).toHaveLength(2);
    expect(() => hashing.getNode("key", [""])).toThrow(RangeError);
    expect(() => hashing.rank("key", [""])).toThrow(RangeError);
  });

  it("emits selection trace events", () => {
    const events: unknown[] = [];
    const traced = new RendezvousHashing({ onTrace: (event) => events.push(event) });
    expect(traced.getNode("key", ["a"])).toBe("a");
    expect(events).toHaveLength(1);
  });
});
