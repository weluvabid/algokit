import { describe, expect, it } from "vitest";
import { aStar, type AStarTraceEvent, type Graph } from "#graph";
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
const heuristic = () => 0;

describe("aStar", () => {
  it("finds the least-cost path and records actual execution", () => {
    const recorder = createTraceRecorder<AStarTraceEvent>();
    const result = aStar(graph, "A", "D", { heuristic, onTrace: recorder.emit });
    expect(result.path).toEqual(["A", "C", "B", "D"]);
    expect(result.cost).toBe(3.5);
    expect(recorder.events.map((event) => event.type)).toContain("expand");
    expect(recorder.events.at(-1)).toMatchObject({ type: "finish", node: "D", g: 3.5 });
  });

  it("handles missing paths and start equals goal", () => {
    expect(aStar(new Map([["A", []]]), "A", "Z", { heuristic }).path).toBeNull();
    expect(aStar(new Map(), "A", "A", { heuristic })).toMatchObject({ path: ["A"], cost: 0 });
  });

  it("rejects negative edge costs", () => {
    expect(() => aStar(new Map([["A", [{ to: "B", cost: -1 }]]]), "A", "B", { heuristic })).toThrow(
      RangeError,
    );
  });
});
