import { describe, expect, it } from "vitest";
import {
  breadthFirstSearch,
  depthFirstSearch,
  dijkstra,
  hasCycle,
  topologicalSort,
  type Graph,
  type TraversalTraceEvent,
} from "#graph";
import { createTraceRecorder } from "#trace";

const graph: Graph = new Map([
  [
    "A",
    [
      { to: "B", cost: 2 },
      { to: "C", cost: 1 },
    ],
  ],
  ["B", [{ to: "D", cost: 2 }]],
  [
    "C",
    [
      { to: "B", cost: 0.5 },
      { to: "D", cost: 8 },
    ],
  ],
  ["D", []],
]);

describe("graph traversal", () => {
  it("visits breadth-first and records execution events", () => {
    const recorder = createTraceRecorder<TraversalTraceEvent>();
    expect(breadthFirstSearch(graph, "A", { onTrace: recorder.emit })).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
    expect(recorder.events[0]).toEqual({ type: "discover", node: "A" });
    expect(recorder.events.at(-1)).toEqual({ type: "visit", node: "D" });
  });

  it("visits depth-first in adjacency order", () => {
    expect(depthFirstSearch(graph, "A")).toEqual(["A", "B", "D", "C"]);
  });

  it("handles cycles and unknown start nodes", () => {
    const cyclic: Graph = new Map([
      ["A", [{ to: "B", cost: 1 }]],
      ["B", [{ to: "A", cost: 1 }]],
    ]);
    expect(breadthFirstSearch(cyclic, "A")).toEqual(["A", "B"]);
    expect(depthFirstSearch(cyclic, "A")).toEqual(["A", "B"]);
    expect(breadthFirstSearch(new Map(), "missing")).toEqual(["missing"]);
  });
});

describe("dijkstra", () => {
  it("finds the least-cost path and traces actual execution", () => {
    const events: { type: string; node: string; cost?: number }[] = [];
    const result = dijkstra(graph, "A", "D", { onTrace: (event) => events.push(event) });
    expect(result).toMatchObject({ path: ["A", "C", "B", "D"], cost: 3.5 });
    expect(events.map((event) => event.type)).toContain("expand");
    expect(events.at(-1)).toMatchObject({ type: "finish", node: "D", cost: 3.5 });
  });

  it("handles unreachable goals and identical endpoints", () => {
    expect(dijkstra(new Map([["A", []]]), "A", "Z")).toMatchObject({
      path: null,
      cost: Infinity,
      expanded: 1,
    });
    expect(dijkstra(new Map(), "A", "A")).toMatchObject({ path: ["A"], cost: 0 });
  });

  it("rejects negative and non-finite edge costs and overflow", () => {
    expect(() => dijkstra(new Map([["A", [{ to: "B", cost: -1 }]]]), "A", "B")).toThrow(RangeError);
    expect(() => dijkstra(new Map([["A", [{ to: "B", cost: Infinity }]]]), "A", "B")).toThrow(
      RangeError,
    );
    expect(() =>
      dijkstra(
        new Map([
          ["A", [{ to: "B", cost: Number.MAX_VALUE }]],
          ["B", [{ to: "C", cost: Number.MAX_VALUE }]],
        ]),
        "A",
        "C",
      ),
    ).toThrow(RangeError);
  });
});

describe("topological ordering and cycle detection", () => {
  it("orders dependencies before dependents, including target-only nodes", () => {
    const dag: Graph = new Map([
      ["compile", [{ to: "test", cost: 1 }]],
      ["lint", [{ to: "test", cost: 1 }]],
    ]);
    const result = topologicalSort(dag);
    expect(result).not.toBeNull();
    expect(result!.indexOf("compile")).toBeLessThan(result!.indexOf("test"));
    expect(result!.indexOf("lint")).toBeLessThan(result!.indexOf("test"));
    expect(new Set(result).size).toBe(3);
    expect(hasCycle(dag)).toBe(false);
  });

  it("detects self-loops and multi-node cycles", () => {
    expect(hasCycle(new Map([["A", [{ to: "A", cost: 1 }]]]))).toBe(true);
    expect(
      topologicalSort(
        new Map([
          ["A", [{ to: "B", cost: 1 }]],
          ["B", [{ to: "A", cost: 1 }]],
        ]),
      ),
    ).toBeNull();
  });

  it("handles an empty graph", () => {
    expect(topologicalSort(new Map())).toEqual([]);
    expect(hasCycle(new Map())).toBe(false);
  });
});
