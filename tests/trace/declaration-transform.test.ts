import { describe, expect, it } from "vitest";
import { stripTraceDeclarations } from "../../tooling/declaration-transform.js";

describe("stripTraceDeclarations", () => {
  it("removes trace-typed members without hardcoded interface names", () => {
    const source = `import type { TraceSink } from "#trace";
export interface AStarTraceEvent { readonly node: string }
export interface AStarOptions {
  readonly heuristic: (node: string) => number;
  readonly onTrace?: TraceSink<AStarTraceEvent>;
}
export interface TraversalOptions {
  readonly onTrace?: TraceSink<{ readonly node: string }>;
  readonly limit?: number;
}
export interface DijkstraOptions { readonly onTrace?: TraceSink<string> }
`;

    const result = stripTraceDeclarations(source);
    expect(result.code).toContain("heuristic:");
    expect(result.code).toContain("limit?: number");
    expect(result.code).not.toContain("onTrace");
    expect(result.code).not.toContain("TraceSink");
    expect(result.code).not.toContain("AStarTraceEvent");
    expect(result.code).not.toContain('from "#trace"');
    expect(result.removedMembers).toBe(3);
  });

  it("preserves unrelated properties with trace-like names", () => {
    const source = `import type { TraceSink } from "#trace";
export interface Options {
  readonly traceCount: number;
  readonly trace?: boolean;
  readonly onTrace?: TraceSink<string>;
  readonly callback: (value: string) => void;
}
`;
    const result = stripTraceDeclarations(source).code;
    expect(result).toContain("traceCount: number");
    expect(result).toContain("trace?: boolean");
    expect(result).toContain("callback: (value: string) => void");
    expect(result).not.toContain("onTrace");
  });

  it("removes transitively trace-only declaration aliases", () => {
    const source = `import type { TraceSink } from "#trace";
export type TracePayload = { readonly id: string };
export type TraceCallback = TraceSink<TracePayload>;
export interface Options { readonly onTrace?: TraceCallback; readonly enabled?: boolean }
`;
    const result = stripTraceDeclarations(source).code;
    expect(result).toContain("enabled?: boolean");
    expect(result).not.toContain("TracePayload");
    expect(result).not.toContain("TraceCallback");
    expect(result).not.toContain("TraceSink");
  });

  it("keeps a type declaration that has a non-trace consumer", () => {
    const source = `import type { TraceSink } from "#trace";
export interface Payload { readonly id: string }
export interface Options { readonly onTrace?: TraceSink<Payload> }
export function consume(payload: Payload): void;
`;
    const result = stripTraceDeclarations(source).code;
    expect(result).toContain("interface Payload");
    expect(result).toContain("consume(payload: Payload)");
    expect(result).not.toContain("TraceSink");
  });

  it("does not rewrite source when no trace import exists", () => {
    const source = `export interface Options { readonly onTrace?: () => void }`;
    expect(stripTraceDeclarations(source).code).toBe(source);
  });

  it("handles comments, generics, optional members, and string-literal member names", () => {
    const source = `import type { TraceSink } from "#trace";
export interface Options<T> {
  /** retained */ readonly value?: T;
  readonly "trace-event"?: TraceSink<T>;
}
`;
    const result = stripTraceDeclarations(source).code;
    expect(result).toContain("value?: T");
    expect(result).not.toContain("trace-event");
    expect(result).not.toContain("TraceSink");
  });

  it("strips trace members from object type aliases as well as interfaces", () => {
    const source = `import type { TraceSink } from "#trace";
export type Options = { readonly enabled: boolean; readonly onTrace?: TraceSink<string> };`;
    const result = stripTraceDeclarations(source).code;
    expect(result).toContain("enabled: boolean");
    expect(result).not.toContain("onTrace");
    expect(result).not.toContain("TraceSink");
  });

  it("rejects a trace type that remains in an unsupported public type position", () => {
    const source = `import type { TraceSink } from "#trace";
export type Callback = TraceSink<string>;`;
    expect(() => stripTraceDeclarations(source)).toThrow(/trace type TraceSink remains/);
  });

  it("preserves empty options interfaces referenced by public signatures", () => {
    const source = `import type { TraceSink } from "#trace";
export interface Options { readonly onTrace?: TraceSink<string> }
export function run(options?: Options): void;`;
    const result = stripTraceDeclarations(source).code;
    expect(result).toContain("interface Options {");
    expect(result).toContain("run(options?: Options)");
    expect(result).not.toContain("TraceSink");
  });
  it("follows locally aliased trace imports", () => {
    const source = `import type { TraceSink as Sink } from "#trace";
export interface Options { readonly report?: Sink<string>; readonly name: string }`;
    const result = stripTraceDeclarations(source).code;
    expect(result).toContain("name: string");
    expect(result).not.toContain("report");
    expect(result).not.toContain("Sink");
  });

  it("fails closed on cyclic trace-only aliases", () => {
    const source = `import type { TraceSink } from "#trace";
type Callback = Callback | TraceSink<string>;
export interface Options { readonly callback?: Callback }`;
    expect(() => stripTraceDeclarations(source)).toThrow(/trace type TraceSink remains/);
  });
});

describe("stripTraceDeclarations", () => {
  it("removes trace-only parameters from function declarations", () => {
    const input = `import type { TraceSink } from "#trace";
export declare function detectSortedRuns<T>(values: readonly T[], compare: (a: T, b: T) => number, onTrace?: TraceSink<unknown>): readonly T[];`;
    const result = stripTraceDeclarations(input, "merge/index.d.ts");
    expect(result.code).not.toContain("TraceSink");
    expect(result.code).toContain("compare: (a: T, b: T) => number");
    expect(result.code).not.toContain("onTrace");
  });
});
