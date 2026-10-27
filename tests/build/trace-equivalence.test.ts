import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { stripTrace } from "../../tooling/trace-transform/index.js";

async function sourceFiles(directory: URL): Promise<URL[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);

      return entry.isDirectory() ? sourceFiles(path) : path.pathname.endsWith(".ts") ? [path] : [];
    }),
  );

  return files.flat();
}

describe("performance transform", () => {
  it("strips instrumentation without changing computational statements", async () => {
    const source = await readFile(
      new URL("../../src/graph/shortest-path.ts", import.meta.url),
      "utf8",
    );
    const result = stripTrace(source, "src/graph/shortest-path.ts");
    expect(result.removedCalls).toBeGreaterThan(0);
    expect(result.code).not.toMatch(/\btrace\s*\./);
    expect(result.code).not.toMatch(/^import\s+(?!type\b)[^;]*from "#trace"/m);
    expect(result.code).toContain("distances.set(edge.to, candidate)");
    expect(result.code).toContain("frontier.push(");
  });

  it("can strip every source module that uses the reserved trace namespace", async () => {
    const files = await sourceFiles(new URL("../../src/", import.meta.url));
    const instrumented: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");

      if (!source.includes('import * as trace from "#trace"')) continue;

      const relativePath = file.pathname.split("/src/").at(-1)!;
      const result = stripTrace(source, `src/${relativePath}`);
      expect(result.removedCalls, relativePath).toBeGreaterThan(0);
      expect(result.code, relativePath).not.toMatch(/\btrace\s*\./);
      expect(result.code, relativePath).not.toMatch(/^import\s+(?!type\b)[^;]*from "#trace"/m);
      instrumented.push(relativePath);
    }

    expect(instrumented.length).toBeGreaterThanOrEqual(10);
  });
});
