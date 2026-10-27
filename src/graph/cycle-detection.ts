import type { Graph } from "./types.js";
import { topologicalSort } from "./topological-sort.js";

export function hasCycle(graph: Graph): boolean {
  return topologicalSort(graph) === null;
}
