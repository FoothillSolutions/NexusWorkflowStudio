import { describe, expect, it } from "bun:test";
import { applyDecisions, computeHunks } from "@/lib/diff/compute";
import type { HunkDecision } from "@/lib/diff/types";

function decide(ids: string[], decision: HunkDecision): Map<string, HunkDecision> {
  const out = new Map<string, HunkDecision>();
  for (const id of ids) out.set(id, decision);
  return out;
}

describe("computeHunks", () => {
  it("returns no hunks for identical strings", () => {
    const hunks = computeHunks("a\nb\nc\n", "a\nb\nc\n");
    expect(hunks).toHaveLength(0);
  });

  it("detects a pure addition at end of file", () => {
    const oldText = "one\ntwo\n";
    const newText = "one\ntwo\nthree\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines.every((l) => l.kind === "added")).toBe(true);
    expect(hunks[0].splittable).toBe(true);
  });

  it("detects a pure removal", () => {
    const oldText = "one\ntwo\nthree\n";
    const newText = "one\nthree\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(1);
    const removed = hunks[0].lines.filter((l) => l.kind === "removed");
    expect(removed.map((l) => l.text)).toEqual(["two"]);
    expect(hunks[0].splittable).toBe(true);
  });

  it("detects a balanced line-for-line replacement and marks it splittable", () => {
    const oldText = "A\nB\nC\n";
    const newText = "A\nX\nC\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].splittable).toBe(true);
    const kinds = hunks[0].lines.map((l) => l.kind).sort();
    expect(kinds).toEqual(["added", "removed"]);
  });

  it("marks mismatched-length replacement as non-splittable", () => {
    const oldText = "A\nB\nC\n";
    const newText = "A\nX\nY\nZ\nC\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].splittable).toBe(false);
  });

  it("attaches context before and after the hunk", () => {
    const oldText = "a\nb\nc\nOLD\nd\ne\nf\n";
    const newText = "a\nb\nc\nNEW\nd\ne\nf\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].contextBefore).toEqual(["a", "b", "c"]);
    expect(hunks[0].contextAfter).toEqual(["d", "e", "f"]);
  });

  it("handles single-line content with no newlines", () => {
    const hunks = computeHunks("hello", "world");
    expect(hunks).toHaveLength(1);
    const kinds = hunks[0].lines.map((l) => l.kind).sort();
    expect(kinds).toEqual(["added", "removed"]);
  });
});

describe("applyDecisions", () => {
  it("accept-all reproduces newText", () => {
    const oldText = "A\nB\nC\n";
    const newText = "A\nX\nC\n";
    const hunks = computeHunks(oldText, newText);
    const merged = applyDecisions({
      oldText,
      newText,
      hunks,
      hunkDecisions: decide(hunks.map((h) => h.id), "accepted"),
      lineDecisions: new Map(),
    });
    expect(merged).toBe(newText);
  });

  it("reject-all reproduces oldText", () => {
    const oldText = "A\nB\nC\n";
    const newText = "A\nX\nC\n";
    const hunks = computeHunks(oldText, newText);
    const merged = applyDecisions({
      oldText,
      newText,
      hunks,
      hunkDecisions: decide(hunks.map((h) => h.id), "rejected"),
      lineDecisions: new Map(),
    });
    expect(merged).toBe(oldText);
  });

  it("pending decisions keep the old side", () => {
    const oldText = "A\nB\nC\n";
    const newText = "A\nX\nC\n";
    const hunks = computeHunks(oldText, newText);
    const merged = applyDecisions({
      oldText,
      newText,
      hunks,
      hunkDecisions: new Map(),
      lineDecisions: new Map(),
    });
    expect(merged).toBe(oldText);
  });

  it("mixes accepts and rejects across multiple hunks", () => {
    // With default contextLines=3, hunks are grouped when the unchanged gap
    // between them is ≤ 6 lines. We use a 10-line gap to guarantee two
    // separate hunks.
    const oldText = [
      "A", "B",
      "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10",
      "H", "I",
    ].join("\n") + "\n";
    const newText = [
      "A", "BB",
      "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10",
      "HH", "I",
    ].join("\n") + "\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(2);

    // Accept only the first hunk.
    const decisions = new Map<string, HunkDecision>();
    decisions.set(hunks[0].id, "accepted");
    decisions.set(hunks[1].id, "rejected");

    const merged = applyDecisions({
      oldText,
      newText,
      hunks,
      hunkDecisions: decisions,
      lineDecisions: new Map(),
    });
    const expected = [
      "A", "BB",
      "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10",
      "H", "I",
    ].join("\n") + "\n";
    expect(merged).toBe(expected);
  });

  it("preserves trailing newline when both sides have one", () => {
    const oldText = "a\nb\n";
    const newText = "a\nc\n";
    const hunks = computeHunks(oldText, newText);
    const merged = applyDecisions({
      oldText,
      newText,
      hunks,
      hunkDecisions: decide(hunks.map((h) => h.id), "accepted"),
      lineDecisions: new Map(),
    });
    expect(merged.endsWith("\n")).toBe(true);
  });

  it("omits trailing newline when neither side has one", () => {
    const oldText = "a\nb";
    const newText = "a\nc";
    const hunks = computeHunks(oldText, newText);
    const merged = applyDecisions({
      oldText,
      newText,
      hunks,
      hunkDecisions: decide(hunks.map((h) => h.id), "accepted"),
      lineDecisions: new Map(),
    });
    expect(merged.endsWith("\n")).toBe(false);
    expect(merged).toBe(newText);
  });

  it("per-line overrides on a pure addition accept only selected lines", () => {
    const oldText = "A\nB\n";
    const newText = "A\nB\nC\nD\nE\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].splittable).toBe(true);

    // Accept only the first and last added lines (indices 0 and 2 among "added" kinds).
    const addedIndices: number[] = [];
    hunks[0].lines.forEach((l, idx) => { if (l.kind === "added") addedIndices.push(idx); });
    const lineMap = new Map<number, boolean>();
    lineMap.set(addedIndices[0], true);
    lineMap.set(addedIndices[1], false);
    lineMap.set(addedIndices[2], true);

    const lineDecisions = new Map<string, Map<number, boolean>>();
    lineDecisions.set(hunks[0].id, lineMap);

    const merged = applyDecisions({
      oldText,
      newText,
      hunks,
      hunkDecisions: new Map(),
      lineDecisions,
    });
    // Expect A,B,C,E (D rejected).
    expect(merged).toBe("A\nB\nC\nE\n");
  });
});
