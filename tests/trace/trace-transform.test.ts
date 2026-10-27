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
    expect(() => {
      stripTrace(source);
    }).toThrow(/standalone trace calls/);
  });
});

it("removes multiple calls but preserves shadowed local bindings", () => {
  const source = `import * as trace from "./trace.js";
trace.emit(sink, { step: 1 });
function local(trace: { emit(value: string): void }) { trace.emit("keep"); }
trace.emit(sink, { step: 2 });
export { local };`;
  const result = stripTrace(source);
  expect(result.removedCalls).toBe(2);
  expect(result.code).not.toContain("import * as trace");
  expect(result.code).toContain('trace.emit("keep")');
  expect(result.code).toContain("export { local }");
});

it("removes calls with nested arguments without removing surrounding statements", () => {
  const source = `import * as trace from "./trace.js";
const value = compute({ nested: [1, 2, 3] });
trace.emit(sink, { value: wrap(value, { ok: true }) });
export { value };`;
  const result = stripTrace(source);
  expect(result.removedCalls).toBe(1);
  expect(result.code).toContain("const value = compute");
  expect(result.code).toContain("export { value }");
  expect(result.code).not.toContain("trace.emit");
});

it.each([
  `const value = trace.emit(sink, {});`,
  `consume(trace.emit(sink, {}));`,
  `trace.emit?.(sink, {});`,
  `const value = trace.emit;`,
])("rejects unsupported trace usage: %s", (usage) => {
  expect(() => stripTrace(`import * as trace from "./trace.js";\n${usage}`)).toThrow(
    /standalone trace calls/,
  );
});

it("removes an unused reserved trace namespace import", () => {
  const result = stripTrace(`import * as trace from "./trace.js";\nexport const value = 1;`);
  expect(result.removedCalls).toBe(0);
  expect(result.code).not.toContain("import * as trace");
  expect(result.code).toContain("export const value = 1");
});
