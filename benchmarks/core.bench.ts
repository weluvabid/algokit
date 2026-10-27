import { describe, test } from "vitest";
import { binarySearch, lowerBound } from "../src/binary-search/index.js";
import { kWayMerge } from "../src/merge/index.js";
import { PriorityQueue } from "../src/priority-queue/index.js";

const compareNumber = (a: number, b: number): number => a - b;
const sorted = Array.from({ length: 10_000 }, (_, index) => index * 2);
const sequences = Array.from({ length: 32 }, (_, source) =>
    Array.from({ length: 512 }, (_, index) => index * 32 + source),
);
const mergedReference = sequences.flat().sort(compareNumber);

describe("binary search (10k values)", () => {
  test("binarySearch: hit", async ({ bench }) => {
    await bench("binarySearch: hit", () => {
      binarySearch(sorted, 12_346, { compare: compareNumber });
    }).run();
  });

  test("lowerBound: miss/insertion point", async ({ bench }) => {
    await bench("lowerBound: miss/insertion point", () => {
      lowerBound(sorted, 12_347, compareNumber);
    }).run();
  });

  test("linear search: hit baseline", async ({ bench }) => {
    await bench("linear search: hit baseline", () => {
      sorted.findIndex((value) => value === 12_346);
    }).run();
  });
});

describe("k-way merge (32 × 512 values)", () => {
  test("kWayMerge", async ({ bench }) => {
    await bench("kWayMerge", () => {
      kWayMerge(sequences, { compare: compareNumber });
    }).run();
  });

  test("flatten + sort baseline", async ({ bench }) => {
    await bench("flatten + sort baseline", () => {
      sequences.flat().sort(compareNumber);
    }).run();
  });

  test("reference output sanity", () => {
    if (mergedReference.length !== 16_384) {
      throw new Error("Unexpected reference output length");
    }
  });
});

describe("priority queue (10k values)", () => {
  test("heap push + pop", async ({ bench }) => {
    await bench("heap push + pop", () => {
      const queue = new PriorityQueue<number>(compareNumber);
      for (let value = 10_000; value > 0; value--) queue.push(value);
      while (!queue.isEmpty) queue.pop();
    }).run();
  });

  test("sort baseline", async ({ bench }) => {
    await bench("sort baseline", () => {
      const values = Array.from({ length: 10_000 }, (_, index) => 10_000 - index);
      values.sort(compareNumber);
    }).run();
  });
});
