import * as trace from "#trace";
import type { TraceSink } from "#trace";

export type BinarySearchTraceEvent =
  | { readonly type: "probe"; readonly low: number; readonly high: number; readonly index: number }
  | { readonly type: "found"; readonly low: number; readonly high: number; readonly index: number }
  | { readonly type: "miss"; readonly low: number; readonly high: number }
  | {
      readonly type: "bound-probe";
      readonly bound: "lower" | "upper";
      readonly low: number;
      readonly high: number;
      readonly index: number;
    }
  | { readonly type: "bound-found"; readonly bound: "lower" | "upper"; readonly index: number };

export interface BinarySearchOptions<T> {
  readonly compare: (a: T, b: T) => number;
  readonly onTrace?: TraceSink<BinarySearchTraceEvent>;
}

/** Returns the first index whose value is not less than target. */
export function lowerBound<T>(
  values: readonly T[],
  target: T,
  compare: (a: T, b: T) => number,
  onTrace?: TraceSink<BinarySearchTraceEvent>,
): number {
  let low = 0;
  let high = values.length;

  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    trace.emit(onTrace, { type: "bound-probe", bound: "lower", low, high, index: middle });

    if (compare(values[middle]!, target) < 0) low = middle + 1;
    else high = middle;
  }

  trace.emit(onTrace, { type: "bound-found", bound: "lower", index: low });

  return low;
}

/** Returns the first index whose value is greater than target. */
export function upperBound<T>(
  values: readonly T[],
  target: T,
  compare: (a: T, b: T) => number,
  onTrace?: TraceSink<BinarySearchTraceEvent>,
): number {
  let low = 0;
  let high = values.length;

  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    trace.emit(onTrace, { type: "bound-probe", bound: "upper", low, high, index: middle });

    if (compare(values[middle]!, target) <= 0) low = middle + 1;
    else high = middle;
  }

  trace.emit(onTrace, { type: "bound-found", bound: "upper", index: low });

  return low;
}

/**
 * Returns the index of a matching value, or -(insertion point) - 1 when absent.
 * Duplicate matches may return any matching index.
 */
export function binarySearch<T>(
  values: readonly T[],
  target: T,
  options: BinarySearchOptions<T>,
): number {
  let low = 0;
  let high = values.length - 1;

  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    trace.emit(options.onTrace, { type: "probe", low, high, index: middle });
    const order = options.compare(values[middle]!, target);

    if (order === 0) {
      trace.emit(options.onTrace, { type: "found", low, high, index: middle });

      return middle;
    }

    if (order < 0) low = middle + 1;
    else high = middle - 1;
  }

  trace.emit(options.onTrace, { type: "miss", low, high });

  return -low - 1;
}
