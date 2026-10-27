import type { TraceSink } from "#trace";

export interface Edge {
  readonly to: string;
  readonly cost: number;
}

export type Graph = ReadonlyMap<string, readonly Edge[]>;

export type AStarTraceEvent =
  | { readonly type: "discover"; readonly node: string; readonly g: number; readonly f: number }
  | { readonly type: "expand"; readonly node: string; readonly g: number; readonly f: number }
  | {
      readonly type: "relax";
      readonly node: string;
      readonly from: string;
      readonly g: number;
      readonly f: number;
    }
  | { readonly type: "finish"; readonly node: string; readonly g: number; readonly f: number };

export interface AStarOptions {
  readonly heuristic: (node: string, goal: string) => number;
  readonly onTrace?: TraceSink<AStarTraceEvent>;
}

export interface AStarResult {
  readonly path: readonly string[] | null;
  readonly cost: number;
  readonly expanded: number;
}

export type TraversalTraceEvent =
  | { readonly type: "discover"; readonly node: string; readonly from?: string }
  | { readonly type: "visit"; readonly node: string; readonly from?: string };

export type TopologicalSortTraceEvent =
  | { readonly type: "node-ready"; readonly node: string }
  | { readonly type: "node-emitted"; readonly node: string; readonly orderIndex: number }
  | { readonly type: "cycle-detected"; readonly remaining: number };

export interface TopologicalSortOptions {
  readonly onTrace?: TraceSink<TopologicalSortTraceEvent>;
}

export type CycleDetectionTraceEvent = TopologicalSortTraceEvent;

export interface CycleDetectionOptions {
  readonly onTrace?: TraceSink<CycleDetectionTraceEvent>;
}

export interface TraversalOptions {
  readonly onTrace?: TraceSink<TraversalTraceEvent>;
}

export type DijkstraTraceEvent =
  | { readonly type: "discover"; readonly node: string; readonly cost: number }
  | { readonly type: "expand"; readonly node: string; readonly cost: number }
  | {
      readonly type: "relax";
      readonly node: string;
      readonly from: string;
      readonly cost: number;
    }
  | { readonly type: "finish"; readonly node: string; readonly cost: number };

export interface DijkstraOptions {
  readonly onTrace?: TraceSink<DijkstraTraceEvent>;
}

export interface ShortestPathResult {
  readonly path: readonly string[] | null;
  readonly cost: number;
  readonly expanded: number;
}
