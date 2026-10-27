import { describe, test } from "vitest";
import { binarySearch, lowerBound } from "../dist/binary-search/index.js";
import { kWayMerge } from "../dist/merge/index.js";
import { PriorityQueue } from "../dist/priority-queue/index.js";

const compareNumber = (a: number, b: number): number => a - b;
const runBinarySearch = binarySearch;
const runLowerBound = lowerBound;
const runKWayMerge = kWayMerge;
const sorted = Array.from({ length: 10_000 }, (_, index) => index * 2);
const sequencesFor = (runCount: number, runLength: number): number[][] =>
  Array.from({ length: runCount }, (_, source) =>
    Array.from({ length: runLength }, (_, index) => index * runCount + source),
  );

const mergeCases = [
  { name: "8 × 2048 values", sequences: sequencesFor(8, 2048) },
  { name: "32 × 512 values", sequences: sequencesFor(32, 512) },
  { name: "128 × 128 values", sequences: sequencesFor(128, 128) },
];

describe("binary search (10k values)", () => {
  test("binarySearch: hit", async ({ bench }) => {
    await bench("binarySearch: hit", () => {
      runBinarySearch(sorted, 12_346, { compare: compareNumber });
    }).run();
  });

  test("lowerBound: miss/insertion point", async ({ bench }) => {
    runLowerBound(sorted, 12_347, compareNumber);
    await bench("lowerBound: miss/insertion point", () => {
      runLowerBound(sorted, 12_347, compareNumber);
    }).run();
  });

  test("linear search: hit baseline", async ({ bench }) => {
    await bench("linear search: hit baseline", () => {
      sorted.findIndex((value) => value === 12_346);
    }).run();
  });
});

for (const mergeCase of mergeCases) {
  const { name, sequences } = mergeCase;
  const expectedLength = sequences.reduce((total, sequence) => total + sequence.length, 0);

  describe(`k-way merge (${name})`, () => {
    test("kWayMerge", async ({ bench }) => {
      await bench("kWayMerge", () => {
        runKWayMerge(sequences, { compare: compareNumber });
      }).run();
    });

    test("flatten + sort baseline", async ({ bench }) => {
      await bench("flatten + sort baseline", () => {
        sequences.flat().sort(compareNumber);
      }).run();
    });

    test("reference output sanity", () => {
      const output = runKWayMerge(sequences, { compare: compareNumber });
      if (output.length !== expectedLength) {
        throw new Error("Unexpected merge output length");
      }
      for (let index = 1; index < output.length; index++) {
        if (output[index - 1]! > output[index]!) {
          throw new Error("Merge output is not sorted");
        }
      }
    });
  });
}

describe("priority queue (10k values)", () => {
  const values = Array.from({ length: 10_000 }, (_, index) => 10_000 - index);

  test("heap push + pop", async ({ bench }) => {
    await bench("heap push + pop", () => {
      const queue = new PriorityQueue<number>(compareNumber);
      for (const value of values) queue.push(value);
      while (!queue.isEmpty) queue.pop();
    }).run();
  });

  test("sorted-array priority queue push + pop", async ({ bench }) => {
    await bench("sorted-array priority queue push + pop", () => {
      const queue: number[] = [];
      for (const value of values) {
        let low = 0;
        let high = queue.length;
        while (low < high) {
          const middle = low + Math.floor((high - low) / 2);
          if (queue[middle]! < value) low = middle + 1;
          else high = middle;
        }
        queue.splice(low, 0, value);
      }
      while (queue.length > 0) queue.shift();
    }).run();
  });
});
