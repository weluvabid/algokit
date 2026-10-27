import * as trace from "#trace";
import type { TraceSink } from "#trace";
import { hash64FNV1a } from "#hash64";

export interface BloomFilterOptions {
  readonly expectedItems: number;
  readonly falsePositiveRate: number;
  readonly onTrace?: TraceSink<{ readonly type: "add"; readonly bitsSet: number }>;
}

/** A Bloom filter for strings and byte arrays; false positives are possible, false negatives are not. */
export class BloomFilter {
  readonly bitCount: number;
  readonly hashCount: number;
  readonly #bits: Uint8Array;
  readonly #onTrace: BloomFilterOptions["onTrace"];
  #itemsAdded = 0;

  constructor(options: BloomFilterOptions) {
    const { expectedItems, falsePositiveRate } = options;
    if (!Number.isInteger(expectedItems) || expectedItems <= 0) {
      throw new RangeError("expectedItems must be a positive integer");
    }
    if (!(falsePositiveRate > 0 && falsePositiveRate < 1)) {
      throw new RangeError("falsePositiveRate must be between zero and one");
    }
    this.bitCount = Math.max(
      8,
      Math.ceil((-expectedItems * Math.log(falsePositiveRate)) / Math.LN2 ** 2),
    );
    this.hashCount = Math.max(1, Math.round((this.bitCount / expectedItems) * Math.LN2));
    this.#bits = new Uint8Array(Math.ceil(this.bitCount / 8));
    this.#onTrace = options.onTrace;
  }

  get size(): number {
    return this.#itemsAdded;
  }

  add(value: string | Uint8Array): void {
    const [first, second] = this.#hashPair(value);
    for (let i = 0; i < this.hashCount; i++) {
      const index = Number((first + BigInt(i) * second) % BigInt(this.bitCount));
      const byteIndex = index >>> 3;
      this.#bits[byteIndex] = this.#bits[byteIndex]! | (1 << (index & 7));
    }
    this.#itemsAdded++;
    trace.emit(this.#onTrace, { type: "add", bitsSet: this.bitCountSet });
  }

  has(value: string | Uint8Array): boolean {
    const [first, second] = this.#hashPair(value);
    for (let i = 0; i < this.hashCount; i++) {
      const index = Number((first + BigInt(i) * second) % BigInt(this.bitCount));
      if ((this.#bits[index >>> 3]! & (1 << (index & 7))) === 0) return false;
    }
    return true;
  }

  get bitCountSet(): number {
    let count = 0;
    for (let byte of this.#bits) {
      while (byte !== 0) {
        byte &= byte - 1;
        count++;
      }
    }
    return count;
  }

  #hashPair(value: string | Uint8Array): [bigint, bigint] {
    const hash = hash64FNV1a(value);
    const first = hash & 0xffffffffn;
    const second = ((hash >> 32n) | 1n) & 0xffffffffn;
    return [first, second];
  }
}
