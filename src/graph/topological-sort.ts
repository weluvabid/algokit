import type { Graph } from "./types.js";

function graphNodes(graph: Graph): Set<string> {
  const nodes = new Set(graph.keys());

  for (const edges of graph.values()) {
    for (const edge of edges) nodes.add(edge.to);
  }

  return nodes;
}

export function topologicalSort(graph: Graph): readonly string[] | null {
  const nodes = graphNodes(graph);
  const indegree = new Map<string, number>();

  for (const node of nodes) indegree.set(node, 0);

  for (const edges of graph.values()) {
    for (const edge of edges) indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const ready: string[] = [];

  for (const node of nodes) {
    if (indegree.get(node) === 0) ready.push(node);
  }

  const order: string[] = [];
  let head = 0;

  while (head < ready.length) {
    const node = ready[head++]!;
    order.push(node);

    for (const edge of graph.get(node) ?? []) {
      const next = indegree.get(edge.to)! - 1;
      indegree.set(edge.to, next);

      if (next === 0) ready.push(edge.to);
    }
  }

  return order.length === nodes.size ? order : null;
}
