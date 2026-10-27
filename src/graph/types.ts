import type { TraceSink } from "#trace";

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

export interface TraversalTraceEvent {
  readonly type: "discover" | "visit";
  readonly node: string;
  readonly from?: string;
}

export interface TraversalOptions {
  readonly onTrace?: TraceSink<TraversalTraceEvent>;
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
