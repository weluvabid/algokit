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
