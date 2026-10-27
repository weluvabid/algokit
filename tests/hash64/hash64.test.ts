import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { hash64, hash64FNV1a, hash64Parts, mix64 } from "#hash64";

describe("shared 64-bit hashing", () => {
  it("produces stable FNV-1a hashes for known byte sequences", () => {
    expect(hash64FNV1a(new Uint8Array())).toBe(0xcbf29ce484222325n);
    expect(hash64FNV1a("a")).toBe(0xaf63dc4c8601ec8cn);
    expect(hash64FNV1a("hello")).toBe(0xa430d84680aabd0bn);
  });

  it("uses the same UTF-8 representation for strings and byte arrays", () => {
    const bytes = new TextEncoder().encode("café");
    expect(hash64("café")).toBe(hash64(bytes));
    expect(hash64FNV1a("café")).toBe(hash64FNV1a(bytes));
  });

  it("mixes hashes into unsigned 64-bit values", () => {
    for (const value of [0n, 1n, -1n, 0xffffffffffffffffn, 0x123456789abcdef0n]) {
      const result = mix64(value);
      expect(result).toBeGreaterThanOrEqual(0n);
      expect(result).toBeLessThanOrEqual(0xffffffffffffffffn);
      expect(mix64(value)).toBe(result);
    }
  });

  it("frames composite fields without delimiter ambiguity", () => {
    expect(hash64Parts("ab", "c")).not.toBe(hash64Parts("a", "bc"));
    expect(hash64Parts("key\0node", "x")).not.toBe(hash64Parts("key", "node\0x"));
    expect(hash64Parts("", "value")).not.toBe(hash64Parts("value", ""));
    expect(hash64Parts("key", "node")).toBe(hash64Parts("key", "node"));
  });

  it("is deterministic and returns unsigned 64-bit values for arbitrary strings", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const first = hash64(value);
        expect(hash64(value)).toBe(first);
        expect(first).toBeGreaterThanOrEqual(0n);
        expect(first).toBeLessThanOrEqual(0xffffffffffffffffn);
      }),
    );
  });

  it("distinguishes common ambiguous composite-input shapes", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (a, b, c) => {
        if (a.length > 0 && b.length > 0 && c.length > 0) {
          expect(hash64Parts(a + b, c)).not.toBe(hash64Parts(a, b + c));
        }
      }),
    );
  });
});
