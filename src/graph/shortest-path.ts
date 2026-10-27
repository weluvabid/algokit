import * as trace from "#trace";
import type {
  AStarOptions,
  AStarResult,
  DijkstraOptions,
  Graph,
  ShortestPathResult,
} from "./types.js";
import { PriorityQueue } from "#priority-queue";
import { reconstructPath } from "./path-utils.js";

interface FrontierEntry {
  readonly node: string;
  readonly g: number;
  readonly f: number;
  readonly order: number;
}

export function aStar(
  graph: Graph,
  start: string,
  goal: string,
  options: AStarOptions,
): AStarResult {
  const startHeuristic = options.heuristic(start, goal);

  if (!Number.isFinite(startHeuristic)) {
    throw new RangeError("Heuristic must return a finite number");
  }

  const startEdges = graph.get(start);

  if (startEdges === undefined && start !== goal) {
    return { path: null, cost: Infinity, expanded: 0 };
  }

  if (start === goal) {
    trace.emit(options.onTrace, { type: "finish", node: goal, g: 0, f: 0 });

    return { path: [start], cost: 0, expanded: 0 };
  }

  let order = 0;
  const frontier = new PriorityQueue<FrontierEntry>((a, b) => a.f - b.f || a.order - b.order);
  const distances = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, string>();
  frontier.push({ node: start, g: 0, f: startHeuristic, order: order++ });
  trace.emit(options.onTrace, {
    type: "discover",
    node: start,
    g: 0,
    f: startHeuristic,
  });
  let expanded = 0;

  while (!frontier.isEmpty) {
    const current = frontier.pop()!;

    if (current.g !== distances.get(current.node)) continue;

    expanded++;
    trace.emit(options.onTrace, { type: "expand", node: current.node, g: current.g, f: current.f });

    if (current.node === goal) {
      const path = reconstructPath(previous, start, goal);
      trace.emit(options.onTrace, { type: "finish", node: goal, g: current.g, f: current.f });

      return { path, cost: current.g, expanded };
    }

    for (const edge of graph.get(current.node) ?? []) {
      if (!Number.isFinite(edge.cost) || edge.cost < 0) {
        throw new RangeError("A* requires finite, non-negative edge costs");
      }

      const candidate = current.g + edge.cost;

      if (!Number.isFinite(candidate)) throw new RangeError("Path cost overflowed");

      if (candidate >= (distances.get(edge.to) ?? Infinity)) continue;

      const heuristic = options.heuristic(edge.to, goal);

      if (!Number.isFinite(heuristic))
        throw new RangeError("Heuristic must return a finite number");

      const estimate = candidate + heuristic;

      if (!Number.isFinite(estimate)) throw new RangeError("Estimated path cost overflowed");

      distances.set(edge.to, candidate);
      previous.set(edge.to, current.node);
      frontier.push({ node: edge.to, g: candidate, f: estimate, order: order++ });
      trace.emit(options.onTrace, {
        type: "relax",
        node: edge.to,
        from: current.node,
        g: candidate,
        f: estimate,
      });
    }
  }

  return { path: null, cost: Infinity, expanded };
}

interface DijkstraEntry {
  readonly node: string;
  readonly cost: number;
  readonly order: number;
}

export function dijkstra(
  graph: Graph,
  start: string,
  goal: string,
  options: DijkstraOptions = {},
): ShortestPathResult {
  if (graph.get(start) === undefined && start !== goal) {
    return { path: null, cost: Infinity, expanded: 0 };
  }

  if (start === goal) {
    trace.emit(options.onTrace, { type: "finish", node: goal, cost: 0 });

    return { path: [start], cost: 0, expanded: 0 };
  }

  let order = 0;
  const frontier = new PriorityQueue<DijkstraEntry>((a, b) => a.cost - b.cost || a.order - b.order);
  const distances = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, string>();
  frontier.push({ node: start, cost: 0, order: order++ });
  trace.emit(options.onTrace, { type: "discover", node: start, cost: 0 });
  let expanded = 0;

  while (!frontier.isEmpty) {
    const current = frontier.pop()!;

    if (current.cost !== distances.get(current.node)) continue;

    expanded++;
    trace.emit(options.onTrace, { type: "expand", node: current.node, cost: current.cost });

    if (current.node === goal) {
      const path = reconstructPath(previous, start, goal);
      trace.emit(options.onTrace, { type: "finish", node: goal, cost: current.cost });

      return { path, cost: current.cost, expanded };
    }

    for (const edge of graph.get(current.node) ?? []) {
      if (!Number.isFinite(edge.cost) || edge.cost < 0) {
        throw new RangeError("Dijkstra requires finite, non-negative edge costs");
      }

      const candidate = current.cost + edge.cost;

      if (!Number.isFinite(candidate)) throw new RangeError("Path cost overflowed");

      if (candidate >= (distances.get(edge.to) ?? Infinity)) continue;

      distances.set(edge.to, candidate);
      previous.set(edge.to, current.node);
      frontier.push({ node: edge.to, cost: candidate, order: order++ });
      trace.emit(options.onTrace, {
        type: "relax",
        node: edge.to,
        from: current.node,
        cost: candidate,
      });
    }
  }

  return { path: null, cost: Infinity, expanded };
}
