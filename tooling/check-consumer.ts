import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporaryRoot = await mkdtemp(join(tmpdir(), "algokit-consumer-"));
const consumerRoot = join(temporaryRoot, "consumer");

try {
  execFileSync("npm", ["pack", "--pack-destination", temporaryRoot], {
    cwd: root,
    stdio: "pipe",
  });
  const entries = await (await import("node:fs/promises")).readdir(temporaryRoot);
  const tarball = entries.find((entry) => entry.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack did not produce a tarball");

  execFileSync(
    "npm",
    [
      "install",
      "--prefix",
      consumerRoot,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      join(temporaryRoot, tarball),
    ],
    { cwd: root, stdio: "inherit" },
  );

  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
    exports: Record<string, string>;
  };
  const specifiers = Object.keys(packageJson.exports).map((name) =>
    name === "." ? "@weluvabid/algokit" : `@weluvabid/algokit${name.slice(1)}`,
  );
  const script = `
    const specifiers = ${JSON.stringify(specifiers)};
    for (const specifier of specifiers) {
      const module = await import(specifier);
      if (Object.keys(module).length === 0) {
        throw new Error(\`Package subpath has no exports: \${specifier}\`);
      }
    }
    const { binarySearch, lowerBound } = await import("@weluvabid/algokit/binary-search");
    if (binarySearch([1, 3, 5], 3, { compare: (a, b) => a - b }) !== 1) {
      throw new Error("Consumer smoke test failed for binarySearch");
    }
    if (lowerBound([1, 3, 5], 4, (a, b) => a - b) !== 2) {
      throw new Error("Consumer smoke test failed for lowerBound");
    }
    const { PriorityQueue } = await import("@weluvabid/algokit/priority-queue");
    const queue = new PriorityQueue((a, b) => a - b);
    queue.push(2); queue.push(1);
    if (queue.pop() !== 1) throw new Error("Consumer smoke test failed for PriorityQueue");

    const { breadthFirstSearch, dijkstra, topologicalSort } = await import("@weluvabid/algokit/graph");
    const graph = new Map([
      ["A", [{ to: "B", cost: 2 }]],
      ["B", []],
    ]);
    if (breadthFirstSearch(graph, "A").join(",") !== "A,B") {
      throw new Error("Consumer smoke test failed for breadthFirstSearch");
    }
    if (dijkstra(graph, "A", "B").cost !== 2) {
      throw new Error("Consumer smoke test failed for dijkstra");
    }
    if (topologicalSort(graph) === null) {
      throw new Error("Consumer smoke test failed for topologicalSort");
    }

    const { OrderedTree } = await import("@weluvabid/algokit/ordered-tree");
    const tree = new OrderedTree((a, b) => a - b);
    tree.insert(4); tree.insert(2); tree.insert(6);
    if (tree.rank(4) !== 1 || tree.select(2) !== 6) {
      throw new Error("Consumer smoke test failed for OrderedTree");
    }

    const { ImplicitTreap } = await import("@weluvabid/algokit/implicit-treap");
    const treap = new ImplicitTreap([1, 2, 3], { seed: 7 });
    treap.insert(1, 9);
    if (treap.toArray().join(",") !== "1,9,2,3") {
      throw new Error("Consumer smoke test failed for ImplicitTreap");
    }

    const { BloomFilter } = await import("@weluvabid/algokit/bloom-filter");
    const bloom = new BloomFilter({ expectedItems: 100, falsePositiveRate: 0.01 });
    bloom.add("algokit");
    if (!bloom.has("algokit")) throw new Error("Consumer smoke test failed for BloomFilter");

    const { HyperLogLog } = await import("@weluvabid/algokit/hyperloglog");
    const hll = new HyperLogLog({ precision: 8 });
    hll.add("algokit");
    if (!(hll.estimate() > 0)) throw new Error("Consumer smoke test failed for HyperLogLog");

    const { ConsistentHashing } = await import("@weluvabid/algokit/consistent-hashing");
    const ring = new ConsistentHashing({ virtualNodes: 8 });
    ring.addNode("node-a"); ring.addNode("node-b");
    if (!ring.getNode("key")) throw new Error("Consumer smoke test failed for ConsistentHashing");

    const { RendezvousHashing } = await import("@weluvabid/algokit/rendezvous-hashing");
    const rendezvous = new RendezvousHashing();
    if (rendezvous.getNode("key", ["node-a", "node-b"]) === undefined) {
      throw new Error("Consumer smoke test failed for RendezvousHashing");
    }

    const { kWayMerge, mergeSortedRuns } = await import("@weluvabid/algokit/merge");
    if (kWayMerge([[1, 3], [2, 4]], { compare: (a, b) => a - b }).join(",") !== "1,2,3,4") {
      throw new Error("Consumer smoke test failed for kWayMerge");
    }
    if (mergeSortedRuns([3, 1, 2], { compare: (a, b) => a - b }).join(",") !== "1,2,3") {
      throw new Error("Consumer smoke test failed for mergeSortedRuns");
    }
  `;
  execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: consumerRoot,
    stdio: "inherit",
  });

  process.stdout.write(
    `Consumer package verified: ${specifiers.length} exported entry points imported successfully\\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
