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

export interface TraversalTraceEvent {
  readonly type: "discover" | "visit";
  readonly node: string;
  readonly from?: string;
}

export interface TraversalOptions {
  readonly onTrace?: TraceSink<TraversalTraceEvent>;
}

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

export interface DijkstraTraceEvent {
  readonly type: "discover" | "expand" | "relax" | "finish";
  readonly node: string;
  readonly from?: string;
  readonly cost?: number;
}

export interface DijkstraOptions {
  readonly onTrace?: TraceSink<DijkstraTraceEvent>;
}

export interface ShortestPathResult {
  readonly path: readonly string[] | null;
  readonly cost: number;
  readonly expanded: number;
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
      const path = [goal];
      let node = goal;
      while (node !== start) {
        const parent = previous.get(node);
        if (parent === undefined) throw new Error("Broken predecessor chain");
        path.push(parent);
        node = parent;
      }
      path.reverse();
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

export function hasCycle(graph: Graph): boolean {
  return topologicalSort(graph) === null;
}
