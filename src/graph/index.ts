import * as trace from "#trace";
import type { TraceSink } from "#trace";
import { PriorityQueue } from "#priority-queue";

export interface Edge {
  readonly to: string;
  readonly cost: number;
}

export type Graph = ReadonlyMap<string, readonly Edge[]>;

export interface AStarTraceEvent {
  readonly type: "discover" | "expand" | "relax" | "finish";
  readonly node: string;
  readonly from?: string;
  readonly g?: number;
  readonly f?: number;
}

export interface AStarOptions {
  readonly heuristic: (node: string, goal: string) => number;
  readonly onTrace?: TraceSink<AStarTraceEvent>;
}

export interface AStarResult {
  readonly path: readonly string[] | null;
  readonly cost: number;
  readonly expanded: number;
}

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
  if (!Number.isFinite(options.heuristic(start, goal))) {
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
  frontier.push({ node: start, g: 0, f: options.heuristic(start, goal), order: order++ });
  trace.emit(options.onTrace, { type: "discover", node: start, g: 0, f: options.heuristic(start, goal) });
  let expanded = 0;

  while (!frontier.isEmpty) {
    const current = frontier.pop()!;
    if (current.g !== distances.get(current.node)) continue;

    expanded++;
    trace.emit(options.onTrace, { type: "expand", node: current.node, g: current.g, f: current.f });

    if (current.node === goal) {
      const path = [goal];
      let node = goal;
      while (node !== start) {
        const parent = previous.get(node);
        if (parent === undefined) throw new Error("Broken predecessor chain");
        path.push(parent);
        node = parent;
      }
      path.reverse();
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
      if (!Number.isFinite(heuristic)) throw new RangeError("Heuristic must return a finite number");
      const estimate = candidate + heuristic;
      if (!Number.isFinite(estimate)) throw new RangeError("Estimated path cost overflowed");

      distances.set(edge.to, candidate);
      previous.set(edge.to, current.node);
      frontier.push({ node: edge.to, g: candidate, f: estimate, order: order++ });
      trace.emit(options.onTrace, { type: "relax", node: edge.to, from: current.node, g: candidate, f: estimate });
    }
  }

  return { path: null, cost: Infinity, expanded };
}
