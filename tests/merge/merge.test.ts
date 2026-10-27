import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { detectSortedRuns, kWayMerge, mergeSortedRuns } from "#merge";

const compare = (a: number, b: number): number => a - b;

describe("merge utilities", () => {
  it("detects maximal nondecreasing runs using exclusive end indexes", () => {
    expect(detectSortedRuns([1, 2, 2, 0, 3, 1], compare)).toEqual([
      { start: 0, end: 3 },
      { start: 3, end: 5 },
      { start: 5, end: 6 },
    ]);
  });

  it("returns no runs for empty input and one run for sorted input", () => {
    expect(detectSortedRuns([], compare)).toEqual([]);
    expect(detectSortedRuns([1, 1, 2, 3], compare)).toEqual([{ start: 0, end: 4 }]);
  });

  it("merges sorted sequences, including empty sequences and duplicates", () => {
    expect(kWayMerge([[1, 4, 4], [], [1, 2, 8], [3, 9]], { compare })).toEqual([
      1, 1, 2, 3, 4, 4, 8, 9,
    ]);
  });

  it("merges natural sorted runs into ascending output", () => {
    expect(mergeSortedRuns([1, 3, 5, 2, 4, 0, 7, 8], { compare })).toEqual([
      0, 1, 2, 3, 4, 5, 7, 8,
    ]);
  });

  it("preserves every input item and emits trace events", () => {
    const events: string[] = [];
    expect(
      mergeSortedRuns([4, 5, 1, 2, 3], {
        compare,
        onTrace: (event) => events.push(event.type),
      }),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(events).toContain("run-detected");
    expect(events).toContain("value-emitted");
  });

  it("matches flatten-and-sort for arbitrary collections of sorted sequences", () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.integer(), { maxLength: 30 }), { maxLength: 20 }),
        (sequences) => {
          const sorted = sequences.map((sequence) => [...sequence].sort(compare));
          const expected = sorted.flat().sort(compare);
          expect(kWayMerge(sorted, { compare })).toEqual(expected);
        },
      ),
    );
  });

  it("matches a reference sort for arbitrary natural-run input", () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { maxLength: 200 }), (values) => {
        const original = [...values];
        expect(mergeSortedRuns(values, { compare })).toEqual([...values].sort(compare));
        expect(values).toEqual(original);
      }),
    );
  });

  it("supports custom comparators and object values", () => {
    const values = [{ id: 5 }, { id: 1 }, { id: 4 }, { id: 2 }];
    const result = mergeSortedRuns(values, { compare: (a, b) => a.id - b.id });
    expect(result.map(({ id }) => id)).toEqual([1, 2, 4, 5]);
    expect(values.map(({ id }) => id)).toEqual([5, 1, 4, 2]);
  });
});
