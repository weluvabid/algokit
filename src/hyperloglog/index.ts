import * as trace from "#trace";
import type { TraceSink } from "#trace";
import { hash64 } from "#hash64";

export interface HyperLogLogOptions {
  /** Number of index bits. Higher precision uses more memory and improves accuracy. */
  readonly precision?: number;
  readonly onTrace?: TraceSink<{ readonly type: "add"; readonly estimate: number }>;
}

/** HyperLogLog cardinality estimator for strings and byte arrays. */
export class HyperLogLog {
  readonly precision: number;
  readonly #registerCount: number;
  readonly #registers: Uint8Array;
  readonly #onTrace: HyperLogLogOptions["onTrace"];

  constructor(options: HyperLogLogOptions = {}) {
    const precision = options.precision ?? 12;
    if (!Number.isInteger(precision) || precision < 4 || precision > 16) {
      throw new RangeError("precision must be an integer between 4 and 16");
    }
    this.precision = precision;
    this.#registerCount = 1 << precision;
    this.#registers = new Uint8Array(this.#registerCount);
    this.#onTrace = options.onTrace;
  }

  add(value: string | Uint8Array): void {
    const hash = hash64(value);
    const index = Number(hash >> BigInt(64 - this.precision));
    const remainder = (hash << BigInt(this.precision)) & 0xffffffffffffffffn;
    const rank = Math.min(64 - this.precision + 1, leadingZeros64(remainder) + 1);
    if (rank > this.#registers[index]!) this.#registers[index] = rank;
    trace.emit(this.#onTrace, { type: "add", estimate: this.estimate() });
  }

  estimate(): number {
    const m = this.#registerCount;
    const alpha = m === 16 ? 0.673 : m === 32 ? 0.697 : m === 64 ? 0.709 : 0.7213 / (1 + 1.079 / m);
    let inverseSum = 0;
    let zeroCount = 0;
    for (const register of this.#registers) {
      inverseSum += 2 ** -register;
      if (register === 0) zeroCount++;
    }
    const raw = (alpha * m * m) / inverseSum;
    if (raw <= 2.5 * m && zeroCount > 0) return m * Math.log(m / zeroCount);
    const twoTo64 = 18446744073709551616;
    if (raw > twoTo64 / 30) return -twoTo64 * Math.log1p(-raw / twoTo64);
    return raw;
  }

  get registerCount(): number {
    return this.#registerCount;
  }
}

function leadingZeros64(value: bigint): number {
  if (value === 0n) return 64;
  return 64 - value.toString(2).length;
}
