import { describe, expect, it } from "bun:test";
import { threeWayTextMerge } from "@/lib/library-store/merge";

describe("threeWayTextMerge", () => {
  it("returns identical text when both sides match", () => {
    const result = threeWayTextMerge("a\nb\nc", "a\nb\nc", "a\nb\nc");
    expect(result.cleanlyMerged).toBe(true);
    expect(result.content).toBe("a\nb\nc");
  });

  it("takes the side that diverged when the other matches ancestor", () => {
    const result = threeWayTextMerge("a\nb\nc", "a\nb\nc", "a\nB\nc");
    expect(result.cleanlyMerged).toBe(true);
    expect(result.content).toBe("a\nB\nc");
  });

  it("identical concurrent edits merge cleanly", () => {
    const result = threeWayTextMerge("a\nb\nc", "a\nB\nc", "a\nB\nc");
    expect(result.cleanlyMerged).toBe(true);
    expect(result.content).toBe("a\nB\nc");
  });

  it("same-line conflict produces conflict marker", () => {
    const result = threeWayTextMerge("a\nb\nc", "a\nX\nc", "a\nY\nc");
    expect(result.cleanlyMerged).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.content).toContain("<<<<<<<");
    expect(result.content).toContain(">>>>>>>");
  });

  it("add_add conflict when ancestor is empty", () => {
    const result = threeWayTextMerge("", "a", "b");
    expect(result.cleanlyMerged).toBe(false);
    expect(result.conflicts[0]?.conflictType).toBe("add_add");
  });
});
