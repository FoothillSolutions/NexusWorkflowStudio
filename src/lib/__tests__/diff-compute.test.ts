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

  it("detects a pure addition at end of file as a single-line hunk", () => {
    const oldText = "one\ntwo\n";
    const newText = "one\ntwo\nthree\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines).toHaveLength(1);
    expect(hunks[0].lines[0].kind).toBe("added");
    expect(hunks[0].splittable).toBe(true);
  });

  it("detects a pure removal as a single-line hunk", () => {
    const oldText = "one\ntwo\nthree\n";
    const newText = "one\nthree\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines).toHaveLength(1);
    expect(hunks[0].lines[0].kind).toBe("removed");
    expect(hunks[0].lines[0].text).toBe("two");
    expect(hunks[0].splittable).toBe(true);
  });

  it("detects a balanced single-line replacement as a paired-modify hunk", () => {
    const oldText = "A\nB\nC\n";
    const newText = "A\nX\nC\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].splittable).toBe(true);
    const kinds = hunks[0].lines.map((l) => l.kind).sort();
    expect(kinds).toEqual(["added", "removed"]);
  });

  it("splits multi-line change into per-line hunks", () => {
    // Replacement of 2 old → 3 new → 2 modified hunks + 1 added hunk.
    const oldText = "A\nB\nC\nD\n";
    const newText = "A\nX\nY\nZ\nD\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(3);
    // First two hunks: paired modifies.
    expect(hunks[0].lines).toHaveLength(2);
    expect(hunks[0].lines.map((l) => l.kind).sort()).toEqual(["added", "removed"]);
    expect(hunks[1].lines).toHaveLength(2);
    expect(hunks[1].lines.map((l) => l.kind).sort()).toEqual(["added", "removed"]);
    // Third hunk: leftover added-only.
    expect(hunks[2].lines).toHaveLength(1);
    expect(hunks[2].lines[0].kind).toBe("added");
    expect(hunks[2].lines[0].text).toBe("Z");
  });

  it("splits a 3-line pure addition into 3 hunks", () => {
    const oldText = "A\nB\n";
    const newText = "A\nB\nC\nD\nE\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(3);
    for (const h of hunks) {
      expect(h.lines).toHaveLength(1);
      expect(h.lines[0].kind).toBe("added");
    }
    expect(hunks.map((h) => h.lines[0].text)).toEqual(["C", "D", "E"]);
  });

  it("splits a 3-line pure removal into 3 hunks", () => {
    const oldText = "A\nB\nC\nD\nE\n";
    const newText = "A\nE\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(3);
    for (const h of hunks) {
      expect(h.lines).toHaveLength(1);
      expect(h.lines[0].kind).toBe("removed");
    }
    expect(hunks.map((h) => h.lines[0].text)).toEqual(["B", "C", "D"]);
  });

  it("splits a mismatched replacement into paired-modify + leftover added hunks", () => {
    // Old has B, C between A…D; new replaces with X, Y, Z, P, Q.
    // diffLines yields: A unchanged, [B,C] removed, [X,Y,Z,P,Q] added, D unchanged.
    // pairCount=min(2,5)=2 → 2 modified hunks; leftover 3 added hunks.
    const oldText = "A\nB\nC\nD\n";
    const newText = "A\nX\nY\nZ\nP\nQ\nD\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(5);
    // First 2 are paired modifies.
    for (let i = 0; i < 2; i++) {
      expect(hunks[i].lines).toHaveLength(2);
      expect(hunks[i].lines.map((l) => l.kind).sort()).toEqual(["added", "removed"]);
    }
    // Last 3 are added-only.
    expect(hunks[2].lines).toHaveLength(1);
    expect(hunks[2].lines[0].kind).toBe("added");
    expect(hunks[2].lines[0].text).toBe("Z");
    expect(hunks[3].lines[0].text).toBe("P");
    expect(hunks[4].lines[0].text).toBe("Q");
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

  it("accept-all reproduces newText on multi-line replacement", () => {
    const oldText = "A\nB\nC\nD\n";
    const newText = "A\nX\nY\nZ\nD\n";
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

  it("reject-all reproduces oldText on multi-line replacement", () => {
    const oldText = "A\nB\nC\nD\n";
    const newText = "A\nX\nY\nZ\nD\n";
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
    // With per-line hunks, each line-level change is its own hunk regardless of
    // the unchanged gap between them.
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
    // Two modified hunks (B→BB and H→HH).
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

  it("mixed hunk decisions on a multi-line addition accept only selected hunks", () => {
    const oldText = "A\nB\n";
    const newText = "A\nB\nC\nD\nE\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(3);

    // Accept hunk 0 (C) and hunk 2 (E); reject hunk 1 (D).
    const decisions = new Map<string, HunkDecision>();
    decisions.set(hunks[0].id, "accepted");
    decisions.set(hunks[1].id, "rejected");
    decisions.set(hunks[2].id, "accepted");

    const merged = applyDecisions({
      oldText,
      newText,
      hunks,
      hunkDecisions: decisions,
      lineDecisions: new Map(),
    });
    // Expect A, B, C, E (D rejected).
    expect(merged).toBe("A\nB\nC\nE\n");
  });
});
