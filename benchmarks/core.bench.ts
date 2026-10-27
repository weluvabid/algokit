import { performance } from "node:perf_hooks";
import { binarySearch, lowerBound } from "../dist/binary-search/index.js";
import { kWayMerge } from "../dist/merge/index.js";
import { PriorityQueue } from "../dist/priority-queue/index.js";
import { BloomFilter } from "../dist-trace/bloom-filter/index.js";
import { HyperLogLog } from "../dist/hyperloglog/index.js";
import { ConsistentHashing } from "../dist/consistent-hashing/index.js";

const compareNumber = (a: number, b: number): number => a - b;
const sorted = Array.from({ length: 10_000 }, (_, index) => index * 2);
const sequencesFor = (runCount: number, runLength: number): number[][] =>
  Array.from({ length: runCount }, (_, source) =>
    Array.from({ length: runLength }, (_, index) => index * runCount + source),
  );
const values = Array.from({ length: 10_000 }, (_, index) => `item-${index}`);
const mergeCases = [
  { name: "8 × 2048 values", sequences: sequencesFor(8, 2048) },
  { name: "32 × 512 values", sequences: sequencesFor(32, 512) },
  { name: "128 × 128 values", sequences: sequencesFor(128, 128) },
];

interface BenchmarkCase {
  readonly name: string;
  readonly run: () => void;
}

const cases: BenchmarkCase[] = [
  {
    name: "binarySearch hit (10k values)",
    run: () => {
      binarySearch(sorted, 12_346, { compare: compareNumber });
    },
  },
  {
    name: "lowerBound insertion point (10k values)",
    run: () => {
      lowerBound(sorted, 12_347, compareNumber);
    },
  },
  {
    name: "linear search hit baseline (10k values)",
    run: () => {
      sorted.findIndex((value) => value === 12_346);
    },
  },
  ...mergeCases.flatMap(({ name, sequences }) => [
    {
      name: `kWayMerge (${name})`,
      run: () => {
        kWayMerge(sequences, { compare: compareNumber });
      },
    },
    {
      name: `flatten + sort baseline (${name})`,
      run: () => {
        sequences.flat().sort(compareNumber);
      },
    },
  ]),
  {
    name: "heap push + pop (10k values)",
    run: () => {
      const queue = new PriorityQueue<number>(compareNumber);
      for (let value = 10_000; value > 0; value--) queue.push(value);
      while (!queue.isEmpty) queue.pop();
    },
  },
  {
    name: "sorted-array priority queue push + pop (10k values)",
    run: () => {
      const queue: number[] = [];
      for (let value = 10_000; value > 0; value--) {
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
    },
  },
  {
    name: "HyperLogLog insertion (10k values)",
    run: () => {
      const estimator = new HyperLogLog({ precision: 12 });
      for (const value of values) estimator.add(value);
      estimator.estimate();
    },
  },
  {
    name: "Bloom filter insertion with trace occupancy (10k values)",
    run: () => {
      const filter = new BloomFilter({
        expectedItems: values.length,
        falsePositiveRate: 0.01,
        onTrace: () => undefined,
      });
      for (const value of values) filter.add(value);
    },
  },
  {
    name: "consistent-hash ring construction (100 nodes × 128 virtual nodes)",
    run: () => {
      const ring = new ConsistentHashing({ virtualNodes: 128 });
      for (let index = 0; index < 100; index++) ring.addNode(`node-${index}`);
      ring.getNode("benchmark-key");
    },
  },
];

function measure(name: string, run: () => void): void {
  const warmupDurationMs = 250;
  const sampleDurationMs = 500;
  const sampleCount = 5;

  const warmupStart = performance.now();
  while (performance.now() - warmupStart < warmupDurationMs) run();

  const rates: number[] = [];
  for (let sample = 0; sample < sampleCount; sample++) {
    let iterations = 0;
    const start = performance.now();
    while (performance.now() - start < sampleDurationMs) {
      run();
      iterations++;
    }
    const elapsedSeconds = (performance.now() - start) / 1_000;
    rates.push(iterations / elapsedSeconds);
  }

  rates.sort((a, b) => a - b);
  const median = rates[Math.floor(rates.length / 2)]!;
  const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  const min = rates[0]!;
  const max = rates[rates.length - 1]!;
  process.stdout.write(
    `${name}: median ${median.toFixed(2)} ops/s; mean ${mean.toFixed(2)}; range ${min.toFixed(2)}–${max.toFixed(2)}; samples ${sampleCount}\n`,
  );
}

process.stdout.write("AlgoKit benchmarks — direct Node execution of built distributions\n");
process.stdout.write("Each operation is one complete workload; rates are not per individual item.");
for (const benchmark of cases) {
  measure(benchmark.name, benchmark.run);
}
