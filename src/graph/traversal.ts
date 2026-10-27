import * as trace from "#trace";
import type { Graph, TraversalOptions } from "./types.js";

export function breadthFirstSearch(
  graph: Graph,
  start: string,
  options: TraversalOptions = {},
): readonly string[] {
  const visited = new Set<string>([start]);
  const queue = [start];
  const order: string[] = [];
  let head = 0;

  trace.emit(options.onTrace, { type: "discover", node: start });

  while (head < queue.length) {
    const node = queue[head++]!;
    order.push(node);
    trace.emit(options.onTrace, { type: "visit", node });

    for (const edge of graph.get(node) ?? []) {
      if (visited.has(edge.to)) continue;

      visited.add(edge.to);
      queue.push(edge.to);
      trace.emit(options.onTrace, { type: "discover", node: edge.to, from: node });
    }
  }

  return order;
}

export function depthFirstSearch(
  graph: Graph,
  start: string,
  options: TraversalOptions = {},
): readonly string[] {
  const discovered = new Set<string>([start]);
  const order: string[] = [];
  const stack: { node: string; from?: string }[] = [{ node: start }];
  trace.emit(options.onTrace, { type: "discover", node: start });

  while (stack.length > 0) {
    const current = stack.pop()!;
    order.push(current.node);
    trace.emit(options.onTrace, {
      type: "visit",
      node: current.node,
      ...(current.from === undefined ? {} : { from: current.from }),
    });

    const edges = graph.get(current.node) ?? [];

    for (let index = edges.length - 1; index >= 0; index--) {
      const edge = edges[index]!;

      if (discovered.has(edge.to)) continue;

      discovered.add(edge.to);
      trace.emit(options.onTrace, { type: "discover", node: edge.to, from: current.node });
      stack.push({ node: edge.to, from: current.node });
    }
  }

  return order;
}
