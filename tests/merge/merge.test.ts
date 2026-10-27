import { describe, expect, it } from "vitest";
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
});
