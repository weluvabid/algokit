import * as trace from "#trace";
import type { TraceSink } from "#trace";
import { hash64Parts } from "#hash64";

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

      const score = hash64Parts(key, node);

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
      .map((node) => ({ node, score: hash64Parts(key, node) }))
      .sort((a, b) => (a.score > b.score ? -1 : a.score < b.score ? 1 : a.node < b.node ? -1 : 1))
      .map(({ node }) => node);
  }
}
