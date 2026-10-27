import * as trace from "#trace";
import type { TraceSink } from "#trace";

export interface RendezvousHashingOptions {
  readonly onTrace?: TraceSink<{
    readonly type: "selected";
    readonly key: string;
    readonly node: string | undefined;
  }>;
}

/** Highest-random-weight (rendezvous) hashing over a supplied node set. */
export class RendezvousHashing {
  readonly #onTrace: RendezvousHashingOptions["onTrace"];

  constructor(options: RendezvousHashingOptions = {}) {
    this.#onTrace = options.onTrace;
  }

  getNode(key: string, nodes: readonly string[]): string | undefined {
    let winner: string | undefined;
    let winningScore = -1n;
    for (const node of nodes) {
      if (node.length === 0) throw new RangeError("node names must not be empty");
      const score = hash64(`${key}\\0${node}`);
      if (
        winner === undefined ||
        score > winningScore ||
        (score === winningScore && node < winner)
      ) {
        winner = node;
        winningScore = score;
      }
    }
    trace.emit(this.#onTrace, { type: "selected", key, node: winner });
    return winner;
  }

  rank(key: string, nodes: readonly string[]): string[] {
    const unique = [...new Set(nodes)];
    for (const node of unique) {
      if (node.length === 0) throw new RangeError("node names must not be empty");
    }
    return unique
      .map((node) => ({ node, score: hash64(`${key}\\0${node}`) }))
      .sort((a, b) => (a.score > b.score ? -1 : a.score < b.score ? 1 : a.node < b.node ? -1 : 1))
      .map(({ node }) => node);
  }
}

function hash64(value: string): bigint {
  const bytes = new TextEncoder().encode(value);
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
