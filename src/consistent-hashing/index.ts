import * as trace from "#trace";
import type { TraceSink } from "#trace";
import { hash64, hash64Parts } from "#hash64";

export type ConsistentHashingTraceEvent =
  | { readonly type: "node-added"; readonly node: string; readonly ringSize: number }
  | { readonly type: "node-removed"; readonly node: string; readonly ringSize: number }
  | {
      readonly type: "selected";
      readonly key: string | Uint8Array;
      readonly node: string | undefined;
    };

export interface ConsistentHashingOptions {
  readonly virtualNodes?: number;
  readonly onTrace?: TraceSink<ConsistentHashingTraceEvent>;
}

interface RingEntry {
  readonly hash: bigint;
  readonly node: string;
}

/** Consistent hash ring with virtual nodes and deterministic node selection. */
export class ConsistentHashing {
  readonly virtualNodes: number;
  readonly #onTrace: ConsistentHashingOptions["onTrace"];
  readonly #nodes = new Set<string>();
  #ring: RingEntry[] = [];

  constructor(options: ConsistentHashingOptions = {}) {
    const virtualNodes = options.virtualNodes ?? 128;

    if (!Number.isSafeInteger(virtualNodes) || virtualNodes < 1 || virtualNodes > 100_000) {
      throw new RangeError("virtualNodes must be an integer between 1 and 100000");
    }

    this.virtualNodes = virtualNodes;
    this.#onTrace = options.onTrace;
  }

  get size(): number {
    return this.#nodes.size;
  }

  addNode(node: string): void {
    if (node.length === 0) throw new RangeError("node must not be empty");

    if (this.#nodes.has(node)) return;

    const entries: RingEntry[] = [];

    for (let replica = 0; replica < this.virtualNodes; replica++) {
      entries.push({ hash: hash64Parts(node, String(replica)), node });
    }

    entries.sort(compareRingEntries);
    this.#ring = mergeRingEntries(this.#ring, entries);
    this.#nodes.add(node);
    trace.emit(this.#onTrace, { type: "node-added", node, ringSize: this.#ring.length });
  }

  removeNode(node: string): boolean {
    if (!this.#nodes.delete(node)) return false;

    this.#ring = this.#ring.filter((entry) => entry.node !== node);
    trace.emit(this.#onTrace, { type: "node-removed", node, ringSize: this.#ring.length });

    return true;
  }

  getNode(key: string | Uint8Array): string | undefined {
    if (this.#ring.length === 0) {
      trace.emit(this.#onTrace, { type: "selected", key, node: undefined });

      return undefined;
    }

    const hash = hash64(key);
    let low = 0;
    let high = this.#ring.length;

    while (low < high) {
      const middle = (low + high) >>> 1;

      if (this.#ring[middle]!.hash < hash) low = middle + 1;
      else high = middle;
    }

    const node = this.#ring[low === this.#ring.length ? 0 : low]!.node;
    trace.emit(this.#onTrace, { type: "selected", key, node });

    return node;
  }

  nodes(): string[] {
    return [...this.#nodes].sort(compareString);
  }
}

function compareRingEntries(a: RingEntry, b: RingEntry): number {
  return compareBigInt(a.hash, b.hash) || compareString(a.node, b.node);
}

function mergeRingEntries(existing: RingEntry[], added: RingEntry[]): RingEntry[] {
  const merged = new Array<RingEntry>(existing.length + added.length);
  let left = 0;
  let right = 0;
  let output = 0;

  while (left < existing.length && right < added.length) {
    if (compareRingEntries(existing[left]!, added[right]!) <= 0) {
      merged[output++] = existing[left++]!;
    } else {
      merged[output++] = added[right++]!;
    }
  }

  while (left < existing.length) merged[output++] = existing[left++]!;

  while (right < added.length) merged[output++] = added[right++]!;

  return merged;
}

function compareBigInt(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
