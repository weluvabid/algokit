import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Console } from "node:console";
import { performance } from "node:perf_hooks";
import { PriorityQueue } from "../dist/priority-queue/index.js";
import { breadthFirstSearch, dijkstra } from "../dist/graph/index.js";
import { lowerBound } from "../dist/binary-search/index.js";
import { kWayMerge } from "../dist/merge/index.js";
import { OrderedTree } from "../dist/ordered-tree/index.js";
import { ImplicitTreap } from "../dist/implicit-treap/index.js";
import { BloomFilter } from "../dist/bloom-filter/index.js";
import { HyperLogLog } from "../dist/hyperloglog/index.js";
import { ConsistentHashing } from "../dist/consistent-hashing/index.js";
import { RendezvousHashing } from "../dist/rendezvous-hashing/index.js";

interface BenchmarkCase {
  readonly name: string;
  readonly run: () => void;
}

interface BenchmarkResult {
  readonly name: string;
  readonly unit: "ms/op";
  readonly value: number;
  readonly samples: number;
  readonly iterations: number;
  readonly min: number;
  readonly max: number;
}

// Binds a custom console instance directly to standard output streams
const stdoutConsole = new Console({
  stdout: process.stdout,
  stderr: process.stderr,
});
const sampleCount = Number.parseInt(process.env["BENCH_SAMPLES"] ?? "7", 10);
const iterations = Number.parseInt(process.env["BENCH_ITERATIONS"] ?? "20", 10);
const warmupCount = Number.parseInt(process.env["BENCH_WARMUPS"] ?? "3", 10);

if (
  ![sampleCount, iterations, warmupCount].every(Number.isSafeInteger) ||
  sampleCount < 3 ||
  iterations < 1 ||
  warmupCount < 0
) {
  throw new RangeError("BENCH_SAMPLES must be >= 3, BENCH_ITERATIONS >= 1, and BENCH_WARMUPS >= 0");
}

const compareNumber = (a: number, b: number): number => a - b;
const values = Array.from({ length: 10_000 }, (_, index) => index * 2);
const graph = new Map<string, { to: string; cost: number }[]>();

for (let index = 0; index < 1_000; index++) {
  graph.set(String(index), [
    ...(index < 999 ? [{ to: String(index + 1), cost: 1 }] : []),
    ...(index < 998 ? [{ to: String(index + 2), cost: 3 }] : []),
  ]);
}

const nodes = Array.from({ length: 64 }, (_, index) => `node-${index}`);
const sequences = Array.from({ length: 32 }, (_, sequence) =>
  Array.from({ length: 128 }, (_, index) => index * 32 + sequence),
);

const cases: BenchmarkCase[] = [
  {
    name: "priority-queue push+pop (1,000 items)",
    run() {
      const queue = new PriorityQueue<number>(compareNumber);

      for (let index = 999; index >= 0; index--) queue.push(index);

      while (!queue.isEmpty) queue.pop();
    },
  },
  {
    name: "graph BFS (1,000 nodes)",
    run() {
      breadthFirstSearch(graph, "0");
    },
  },
  {
    name: "graph Dijkstra (1,000 nodes)",
    run() {
      dijkstra(graph, "0", "999");
    },
  },
  {
    name: "binary lower bound (10,000 items)",
    run() {
      lowerBound(values, 12_345, compareNumber);
    },
  },
  {
    name: "k-way merge (4,096 items, 32 runs)",
    run() {
      kWayMerge(sequences, { compare: compareNumber });
    },
  },
  {
    name: "ordered tree insert+select (1,000 items)",
    run() {
      const tree = new OrderedTree<number>(compareNumber);

      for (let index = 0; index < 1_000; index++) tree.insert((index * 617) % 1_009);

      for (let index = 0; index < tree.size; index += 10) tree.select(index);
    },
  },
  {
    name: "implicit treap insert+access (1,000 items)",
    run() {
      const treap = new ImplicitTreap<number>();

      for (let index = 0; index < 1_000; index++) treap.push(index);

      for (let index = 0; index < 1_000; index += 10) treap.get(index);
    },
  },
  {
    name: "bloom filter add+has (1,000 items)",
    run() {
      const filter = new BloomFilter({ expectedItems: 1_000, falsePositiveRate: 0.01 });

      for (let index = 0; index < 1_000; index++) filter.add(`key-${index}`);

      for (let index = 0; index < 1_000; index++) filter.has(`key-${index}`);
    },
  },
  {
    name: "HyperLogLog add (1,000 items)",
    run() {
      const sketch = new HyperLogLog({ precision: 10 });

      for (let index = 0; index < 1_000; index++) sketch.add(`key-${index}`);

      sketch.estimate();
    },
  },
  {
    name: "consistent hashing lookup (64 nodes, 1,000 keys)",
    run() {
      const ring = new ConsistentHashing({ virtualNodes: 32 });

      for (const node of nodes) ring.addNode(node);

      for (let index = 0; index < 1_000; index++) ring.getNode(`key-${index}`);
    },
  },
  {
    name: "rendezvous hashing lookup (64 nodes, 100 keys)",
    run() {
      const hashing = new RendezvousHashing();

      for (let index = 0; index < 100; index++) hashing.getNode(`key-${index}`, nodes);
    },
  },
];

function median(numbers: readonly number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function measure(benchmark: BenchmarkCase): BenchmarkResult {
  for (let index = 0; index < warmupCount; index++) benchmark.run();

  const timings: number[] = [];

  for (let index = 0; index < sampleCount; index++) {
    const start = performance.now();

    for (let iteration = 0; iteration < iterations; iteration++) benchmark.run();

    timings.push((performance.now() - start) / iterations);
  }

  return {
    name: benchmark.name,
    unit: "ms/op",
    value: median(timings),
    samples: sampleCount,
    iterations,
    min: Math.min(...timings),
    max: Math.max(...timings),
  };
}

const results = cases.map(measure);
process.stdout.write(
  `\nAlgoKit benchmark results · Node ${process.version} · ${process.platform}/${process.arch}`,
);
process.stdout.write(
  "Times are median milliseconds per workload; lower is better. No thresholds are enforced.\n",
);
stdoutConsole.table(
  results.map(({ name, value, min, max }) => ({
    benchmark: name,
    "median ms/op": value.toFixed(3),
    "min ms/op": min.toFixed(3),
    "max ms/op": max.toFixed(3),
  })),
);

const outputArgument = process.argv.find((argument) => argument.startsWith("--json="));
const outputPath = outputArgument?.slice("--json=".length) ?? process.env["BENCH_OUTPUT"];

if (outputPath) {
  const path = resolve(outputPath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        runtime: { node: process.version, platform: process.platform, arch: process.arch },
        configuration: { sampleCount, iterations, warmupCount },
        results,
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(`\nWrote benchmark results to ${path}`);
}
