import { describe, expect, it } from "bun:test";
import { alignRows } from "@/lib/diff/align";
import { computeHunks } from "@/lib/diff/compute";

describe("alignRows", () => {
  it("returns an empty list for two empty strings", () => {
    const rows = alignRows("", "", computeHunks("", ""));
    expect(rows).toEqual([]);
  });

  it("emits matched unchanged pairs for identical inputs", () => {
    const oldText = "a\nb\nc\n";
    const newText = "a\nb\nc\n";
    const rows = alignRows(oldText, newText, computeHunks(oldText, newText));
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.old?.kind).toBe("unchanged");
      expect(row.new?.kind).toBe("unchanged");
      expect(row.old?.text).toBe(row.new?.text ?? "");
      expect(row.hunkId).toBeUndefined();
      expect(row.kind).toBe("unchanged");
    }
  });

  it("emits null on the old side for a pure addition with each added line in its own hunk", () => {
    const oldText = "a\nb\n";
    const newText = "a\nb\nc\nd\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(2);
    const rows = alignRows(oldText, newText, hunks);
    // Two unchanged + two inserted rows.
    expect(rows).toHaveLength(4);
    expect(rows[0].old?.text).toBe("a");
    expect(rows[0].kind).toBe("unchanged");
    expect(rows[1].old?.text).toBe("b");
    expect(rows[1].kind).toBe("unchanged");
    expect(rows[2].old).toBeNull();
    expect(rows[2].new?.kind).toBe("added");
    expect(rows[2].new?.text).toBe("c");
    expect(rows[2].hunkId).toBe(hunks[0].id);
    expect(rows[2].kind).toBe("added");
    expect(rows[3].old).toBeNull();
    expect(rows[3].new?.text).toBe("d");
    // With per-line hunks, the second added row belongs to hunks[1].
    expect(rows[3].hunkId).toBe(hunks[1].id);
    expect(rows[3].kind).toBe("added");
  });

  it("emits null on the new side for a pure removal with each removed line in its own hunk", () => {
    const oldText = "a\nb\nc\nd\n";
    const newText = "a\nd\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(2);
    const rows = alignRows(oldText, newText, hunks);
    // Rows: a (unchanged), removed b (hunks[0]), removed c (hunks[1]), d (unchanged).
    expect(rows).toHaveLength(4);
    expect(rows[0].old?.text).toBe("a");
    expect(rows[0].kind).toBe("unchanged");
    expect(rows[1].old?.kind).toBe("removed");
    expect(rows[1].old?.text).toBe("b");
    expect(rows[1].new).toBeNull();
    expect(rows[1].hunkId).toBe(hunks[0].id);
    expect(rows[1].kind).toBe("removed");
    expect(rows[2].old?.kind).toBe("removed");
    expect(rows[2].old?.text).toBe("c");
    expect(rows[2].new).toBeNull();
    expect(rows[2].hunkId).toBe(hunks[1].id);
    expect(rows[2].kind).toBe("removed");
    expect(rows[3].old?.text).toBe("d");
    expect(rows[3].new?.text).toBe("d");
    expect(rows[3].kind).toBe("unchanged");
  });

  it("pairs an equal-count replacement 1:1", () => {
    const oldText = "A\nB\nC\n";
    const newText = "A\nX\nC\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(1);
    const rows = alignRows(oldText, newText, hunks);
    // A (unchanged), removed B paired with added X, C (unchanged).
    expect(rows).toHaveLength(3);
    expect(rows[0].old?.text).toBe("A");
    expect(rows[0].kind).toBe("unchanged");
    expect(rows[1].old?.kind).toBe("removed");
    expect(rows[1].old?.text).toBe("B");
    expect(rows[1].new?.kind).toBe("added");
    expect(rows[1].new?.text).toBe("X");
    expect(rows[1].hunkId).toBe(hunks[0].id);
    // Paired old+new with different text → row-level kind is "modified".
    expect(rows[1].kind).toBe("modified");
    expect(rows[2].old?.text).toBe("C");
    expect(rows[2].kind).toBe("unchanged");
  });

  it("splits the shorter side of an unequal replacement into per-line hunks (new-side longer)", () => {
    const oldText = "A\nB\nC\n";
    const newText = "A\nX\nY\nZ\nC\n";
    const hunks = computeHunks(oldText, newText);
    // 1 modified (B→X) + 2 added (Y, Z) = 3 hunks.
    expect(hunks).toHaveLength(3);
    const rows = alignRows(oldText, newText, hunks);
    // A (unchanged), B→X (modified, hunks[0]), null→Y (added, hunks[1]),
    // null→Z (added, hunks[2]), C (unchanged).
    expect(rows).toHaveLength(5);
    expect(rows[0].old?.text).toBe("A");
    expect(rows[1].old?.text).toBe("B");
    expect(rows[1].new?.text).toBe("X");
    expect(rows[1].kind).toBe("modified");
    expect(rows[1].hunkId).toBe(hunks[0].id);
    expect(rows[2].old).toBeNull();
    expect(rows[2].new?.text).toBe("Y");
    expect(rows[2].kind).toBe("added");
    expect(rows[2].hunkId).toBe(hunks[1].id);
    expect(rows[3].old).toBeNull();
    expect(rows[3].new?.text).toBe("Z");
    expect(rows[3].kind).toBe("added");
    expect(rows[3].hunkId).toBe(hunks[2].id);
    expect(rows[4].old?.text).toBe("C");
    expect(rows[4].kind).toBe("unchanged");
  });

  it("splits the shorter side of an unequal replacement into per-line hunks (old-side longer)", () => {
    const oldText = "A\nB\nC\nD\nE\n";
    const newText = "A\nX\nE\n";
    const hunks = computeHunks(oldText, newText);
    // 1 modified (B→X) + 2 removed (C, D) = 3 hunks.
    expect(hunks).toHaveLength(3);
    const rows = alignRows(oldText, newText, hunks);
    // A (unchanged), B→X (modified, hunks[0]), C→null (removed, hunks[1]),
    // D→null (removed, hunks[2]), E (unchanged).
    expect(rows).toHaveLength(5);
    expect(rows[0].old?.text).toBe("A");
    expect(rows[1].old?.text).toBe("B");
    expect(rows[1].new?.text).toBe("X");
    expect(rows[1].kind).toBe("modified");
    expect(rows[1].hunkId).toBe(hunks[0].id);
    expect(rows[2].old?.text).toBe("C");
    expect(rows[2].new).toBeNull();
    expect(rows[2].kind).toBe("removed");
    expect(rows[2].hunkId).toBe(hunks[1].id);
    expect(rows[3].old?.text).toBe("D");
    expect(rows[3].new).toBeNull();
    expect(rows[3].kind).toBe("removed");
    expect(rows[3].hunkId).toBe(hunks[2].id);
    expect(rows[4].old?.text).toBe("E");
    expect(rows[4].new?.text).toBe("E");
    expect(rows[4].kind).toBe("unchanged");
  });

  it("classifies identical inputs as unchanged rows", () => {
    const oldText = "A\nB\n";
    const newText = "A\nB\n";
    const hunks = computeHunks(oldText, newText);
    const rows = alignRows(oldText, newText, hunks);
    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe("unchanged");
    expect(rows[1].kind).toBe("unchanged");
  });

  it("classifies pure-removed hunks as kind=removed and pure-added hunks as kind=added", () => {
    const oldText = "A\nB\nC\n";
    const newText = "A\nC\n";
    const rows = alignRows(oldText, newText, computeHunks(oldText, newText));
    expect(rows).toHaveLength(3);
    expect(rows[0].kind).toBe("unchanged");
    expect(rows[1].kind).toBe("removed");
    expect(rows[2].kind).toBe("unchanged");

    const rows2 = alignRows("A\nC\n", "A\nB\nC\n", computeHunks("A\nC\n", "A\nB\nC\n"));
    expect(rows2).toHaveLength(3);
    expect(rows2[0].kind).toBe("unchanged");
    expect(rows2[1].kind).toBe("added");
    expect(rows2[2].kind).toBe("unchanged");
  });
});
