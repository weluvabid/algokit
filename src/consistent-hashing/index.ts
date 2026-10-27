import * as trace from "#trace";
import type { TraceSink } from "#trace";

export interface ConsistentHashingOptions {
  readonly virtualNodes?: number;
  readonly onTrace?: TraceSink<{
    readonly type: "node-added" | "node-removed";
    readonly node: string;
    readonly ringSize: number;
  }>;
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
    this.#nodes.add(node);
    for (let replica = 0; replica < this.virtualNodes; replica++) {
      this.#ring.push({ hash: hash64(`${node}#${replica}`), node });
    }
    this.#ring.sort((a, b) => compareBigInt(a.hash, b.hash) || compareString(a.node, b.node));
    trace.emit(this.#onTrace, { type: "node-added", node, ringSize: this.#ring.length });
  }

  removeNode(node: string): boolean {
    if (!this.#nodes.delete(node)) return false;
    this.#ring = this.#ring.filter((entry) => entry.node !== node);
    trace.emit(this.#onTrace, { type: "node-removed", node, ringSize: this.#ring.length });
    return true;
  }

  getNode(key: string | Uint8Array): string | undefined {
    if (this.#ring.length === 0) return undefined;
    const hash = hash64(key);
    let low = 0;
    let high = this.#ring.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.#ring[middle]!.hash < hash) low = middle + 1;
      else high = middle;
    }
    return this.#ring[low === this.#ring.length ? 0 : low]!.node;
  }

  nodes(): string[] {
    return [...this.#nodes].sort(compareString);
  }
}

function hash64(value: string | Uint8Array): bigint {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  hash ^= hash >> 30n;
  hash = BigInt.asUintN(64, hash * 0xbf58476d1ce4e5b9n);
  hash ^= hash >> 27n;
  hash = BigInt.asUintN(64, hash * 0x94d049bb133111ebn);
  hash ^= hash >> 31n;
  return BigInt.asUintN(64, hash);
}

function compareBigInt(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
