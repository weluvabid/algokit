import { describe, expect, it } from "vitest";
import { stripTrace } from "../../tooling/trace-transform/index.js";

describe("stripTrace", () => {
  it("removes namespace trace calls and their import", () => {
    const source = `import * as trace from "./trace.js";\nconst value = 2;\ntrace.emit(sink, { value });\nexport { value };`;
    const result = stripTrace(source);
    expect(result.removedCalls).toBe(1);
    expect(result.code).not.toContain("trace");
    expect(result.code).toContain("const value = 2");
    expect(result.code).toContain("export { value }");
  });

  it("preserves unrelated properties and identifiers containing trace", () => {
    const source = `import * as trace from "./trace.js";\nconst traceCount = 1;\nconst object = { trace: true };\ntrace.emit(sink, {});\nexport { traceCount, object };`;
    const result = stripTrace(source);
    expect(result.code).toContain("traceCount");
    expect(result.code).toContain("trace: true");
  });

  it("rejects trace references that cannot be safely removed", () => {
    const source = `import * as trace from "./trace.js";\nconst event = trace.create();`;
    expect(() => stripTrace(source)).toThrow(/standalone trace calls/);
  });
});
