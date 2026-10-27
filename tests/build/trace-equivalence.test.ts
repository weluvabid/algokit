import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { stripTrace } from "../../tooling/trace-transform/index.js";

describe("performance transform proof of concept", () => {
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
});
