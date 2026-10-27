import * as trace from "#trace";
import type { TraceSink } from "#trace";
import { PriorityQueue } from "#priority-queue";

export interface SortedRun {
  readonly start: number;
  /** Exclusive end index. */
  readonly end: number;
}

export interface MergeTraceEvent {
  readonly type: "run-detected" | "value-emitted";
  readonly start?: number;
  readonly end?: number;
  readonly source?: number;
  readonly outputIndex?: number;
}

export interface MergeOptions<T> {
  readonly compare: (a: T, b: T) => number;
  readonly onTrace?: TraceSink<MergeTraceEvent>;
}

interface HeapEntry<T> {
  readonly value: T;
  readonly source: number;
  readonly index: number;
  readonly order: number;
}

/** Splits an array into maximal nondecreasing runs. */
export function detectSortedRuns<T>(
  values: readonly T[],
  compare: (a: T, b: T) => number,
  onTrace?: TraceSink<MergeTraceEvent>,
): readonly SortedRun[] {
  if (values.length === 0) return [];

  const runs: SortedRun[] = [];
  let start = 0;
  for (let index = 1; index < values.length; index++) {
    if (compare(values[index - 1]!, values[index]!) > 0) {
      const run = { start, end: index };
      runs.push(run);
      trace.emit(onTrace, { type: "run-detected", ...run });
      start = index;
    }
  }

  const finalRun = { start, end: values.length };
  runs.push(finalRun);
  trace.emit(onTrace, { type: "run-detected", ...finalRun });
  return runs;
}

/**
 * Merges already-sorted input sequences in ascending comparator order.
 * Equal values are emitted deterministically by source sequence, then input order.
 */
export function kWayMerge<T>(sequences: readonly (readonly T[])[], options: MergeOptions<T>): T[] {
  let order = 0;
  const heap = new PriorityQueue<HeapEntry<T>>(
    (a, b) => options.compare(a.value, b.value) || a.source - b.source || a.order - b.order,
  );
  let totalLength = 0;

  sequences.forEach((sequence, source) => {
    totalLength += sequence.length;
    if (sequence.length > 0) {
      heap.push({ value: sequence[0]!, source, index: 0, order: order++ });
    }
  });

  const output: T[] = [];
  while (!heap.isEmpty) {
    const current = heap.pop()!;
    output.push(current.value);
    trace.emit(options.onTrace, {
      type: "value-emitted",
      source: current.source,
      outputIndex: output.length - 1,
    });

    const nextIndex = current.index + 1;
    const sequence = sequences[current.source]!;
    if (nextIndex < sequence.length) {
      heap.push({
        value: sequence[nextIndex]!,
        source: current.source,
        index: nextIndex,
        order: order++,
      });
    }
  }

  if (output.length !== totalLength) throw new Error("Merge lost input values");
  return output;
}

/** Detects natural ascending runs and merges them into one sorted output. */
export function mergeSortedRuns<T>(values: readonly T[], options: MergeOptions<T>): T[] {
  const runs = detectSortedRuns(values, options.compare, options.onTrace);
  const sequences = runs.map((run) => values.slice(run.start, run.end));
  return kWayMerge(sequences, options);
}
