import type { CycleDetectionOptions, Graph } from "./types.js";
import { topologicalSort } from "./topological-sort.js";

export function hasCycle(graph: Graph, options: CycleDetectionOptions = {}): boolean {
  return topologicalSort(graph, options) === null;
}
