import { describe, expect, it } from "vitest";
import { binarySearch, lowerBound, upperBound } from "#binary-search";
import { BloomFilter } from "#bloom-filter";
import { ConsistentHashing } from "#consistent-hashing";
import {
  aStar,
  breadthFirstSearch,
  depthFirstSearch,
  dijkstra,
  hasCycle,
  topologicalSort,
  type Graph,
} from "#graph";
import { HyperLogLog } from "#hyperloglog";
import { ImplicitTreap } from "#implicit-treap";
import { kWayMerge, detectSortedRuns } from "#merge";
import { OrderedTree } from "#ordered-tree";
import { PriorityQueue } from "#priority-queue";
import { RendezvousHashing } from "#rendezvous-hashing";

describe("trace coverage", () => {
  it("traces priority queue mutations with post-operation sizes", () => {
    const events: string[] = [];
    const queue = new PriorityQueue<number>((a, b) => a - b, {
      onTrace: (event) => events.push(`${event.type}:${event.size}`),
    });
    queue.push(2);
    queue.push(1);
    expect(queue.pop()).toBe(1);
    expect(events).toEqual(["push:1", "push:2", "pop:1"]);
  });

  it("traces BFS, DFS, A*, and Dijkstra execution", () => {
    const graph: Graph = new Map([
      [
        "s",
        [
          { to: "a", cost: 2 },
          { to: "b", cost: 1 },
        ],
      ],
      ["a", [{ to: "g", cost: 2 }]],
      [
        "b",
        [
          { to: "a", cost: 0.5 },
          { to: "g", cost: 10 },
        ],
      ],
      ["g", []],
    ]);
    const bfsEvents: string[] = [];
    const dfsEvents: string[] = [];
    const aStarEvents: string[] = [];
    const dijkstraEvents: string[] = [];

    breadthFirstSearch(graph, "s", { onTrace: (event) => bfsEvents.push(event.type) });
    depthFirstSearch(graph, "s", { onTrace: (event) => dfsEvents.push(event.type) });
    const astarResult = aStar(graph, "s", "g", {
      heuristic: () => 0,
      onTrace: (event) => aStarEvents.push(event.type),
    });
    const dijkstraResult = dijkstra(graph, "s", "g", {
      onTrace: (event) => dijkstraEvents.push(event.type),
    });

    expect(bfsEvents).toContain("discover");
    expect(bfsEvents).toContain("visit");
    expect(dfsEvents).toContain("discover");
    expect(dfsEvents).toContain("visit");
    expect(astarResult).toMatchObject({ path: ["s", "b", "a", "g"], cost: 3.5 });
    expect(aStarEvents).toEqual(expect.arrayContaining(["discover", "expand", "relax", "finish"]));
    expect(dijkstraResult).toMatchObject({ path: ["s", "b", "a", "g"], cost: 3.5 });
    expect(dijkstraEvents).toEqual(
      expect.arrayContaining(["discover", "expand", "relax", "finish"]),
    );
  });

  it("traces topological ordering and cycle detection", () => {
    const dag: Graph = new Map([
      ["a", [{ to: "b", cost: 1 }]],
      ["b", []],
    ]);
    const events: string[] = [];
    expect(topologicalSort(dag, { onTrace: (event) => events.push(event.type) })).toEqual([
      "a",
      "b",
    ]);
    expect(events).toContain("node-ready");
    expect(events).toContain("node-emitted");
    expect(hasCycle(dag)).toBe(false);

    const cyclic: Graph = new Map([
      ["a", [{ to: "b", cost: 1 }]],
      ["b", [{ to: "a", cost: 1 }]],
    ]);
    expect(hasCycle(cyclic, { onTrace: (event) => events.push(event.type) })).toBe(true);
    expect(events).toContain("cycle-detected");
  });

  it("traces Bloom filter membership and HyperLogLog register changes", () => {
    const bloomEvents: string[] = [];
    const bloom = new BloomFilter({
      expectedItems: 10,
      falsePositiveRate: 0.01,
      onTrace: (event) => bloomEvents.push(event.type),
    });
    bloom.add("present");
    expect(bloom.has("present")).toBe(true);
    expect(bloomEvents).toContain("add");
    expect(bloomEvents).toContain("has");

    const hllEvents: string[] = [];
    const hll = new HyperLogLog({
      precision: 4,
      onTrace: (event) => hllEvents.push(event.type),
    });
    hll.add("item");
    expect(hllEvents).toContain("add");
    expect(hllEvents).toContain("register-updated");
  });

  it("traces consistent and rendezvous hash decisions", () => {
    const ringEvents: string[] = [];
    const ring = new ConsistentHashing({ onTrace: (event) => ringEvents.push(event.type) });
    ring.addNode("a");
    expect(ring.getNode("key")).toBe("a");
    expect(ringEvents).toContain("node-added");
    expect(ringEvents).toContain("selected");

    const rendezvousEvents: string[] = [];
    const rendezvous = new RendezvousHashing({
      onTrace: (event) => rendezvousEvents.push(event.type),
    });
    rendezvous.getNode("key", ["a", "b"]);
    rendezvous.rank("key", ["a", "b"]);
    expect(rendezvousEvents).toContain("selected");
    expect(rendezvousEvents).toContain("ranked");
  });

  it("traces treap operations and ordered-tree structural and query events", () => {
    const treapEvents: string[] = [];
    const treap = new ImplicitTreap([3, 4], { onTrace: (event) => treapEvents.push(event.type) });
    expect(treap.get(0)).toBe(3);
    treap.set(0, 5);
    treap.insert(1, 6);
    expect(treap.remove(1)).toBe(6);
    expect(treapEvents).toEqual(expect.arrayContaining(["get", "set", "insert", "remove"]));

    const treeEvents: string[] = [];
    const tree = new OrderedTree<number>((a, b) => a - b, {
      onTrace: (event) => treeEvents.push(event.type),
    });
    tree.insert(1);
    tree.insert(2);
    tree.insert(3);
    tree.rank(3);
    tree.select(0);
    tree.delete(1);
    expect(treeEvents).toEqual(
      expect.arrayContaining(["insert", "rotate-left", "rank", "select", "delete"]),
    );
  });

  it("traces binary search probes and discovered sorted runs and merged values", () => {
    const searchEvents: string[] = [];
    const values = [1, 2, 2, 4];
    expect(
      lowerBound(
        values,
        2,
        (a, b) => a - b,
        (event) => searchEvents.push(event.type),
      ),
    ).toBe(1);
    expect(
      upperBound(
        values,
        2,
        (a, b) => a - b,
        (event) => searchEvents.push(event.type),
      ),
    ).toBe(3);
    expect(
      binarySearch(values, 4, {
        compare: (a, b) => a - b,
        onTrace: (event) => searchEvents.push(event.type),
      }),
    ).toBe(3);
    expect(searchEvents).toEqual(
      expect.arrayContaining(["bound-probe", "bound-found", "probe", "found"]),
    );

    const mergeEvents: string[] = [];
    expect(
      detectSortedRuns(
        [1, 3, 2, 4],
        (a, b) => a - b,
        (event) => mergeEvents.push(event.type),
      ),
    ).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
    expect(
      kWayMerge(
        [
          [1, 3],
          [2, 4],
        ],
        {
          compare: (a, b) => a - b,
          onTrace: (event) => mergeEvents.push(event.type),
        },
      ),
    ).toEqual([1, 2, 3, 4]);
    expect(mergeEvents).toContain("run-detected");
    expect(mergeEvents).toContain("value-emitted");
  });
});
