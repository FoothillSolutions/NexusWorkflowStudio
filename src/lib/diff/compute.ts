// ─── Diff Computation ───────────────────────────────────────────────────────
// Wraps `diffLines` from the `diff` package and turns its flat change list
// into `Hunk[]` — contiguous blocks of change with surrounding context.
// `applyDecisions` is the single source of truth for reconstructing the
// merged text from per-hunk (and optional per-line) accept/reject decisions.

import { diffLines, type Change } from "diff";
import type { Hunk, HunkDecision, HunkLine, LineDecision } from "./types";

// Re-export types from this module for convenience (imported by consumers
// such as the dialog that also needs `applyDecisions`).
export type { Hunk, HunkDecision, HunkLine, LineDecision };

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Split a change value into individual lines while preserving trailing-newline
 * semantics. A block whose value ends with `\n` contains N visible lines; a
 * block without a trailing `\n` contains one line that has no terminator.
 */
function splitLines(value: string): string[] {
  if (value === "") return [];
  const parts = value.split("\n");
  // If the value ends with "\n", split produces a trailing empty string which
  // does not correspond to a visible line. Drop it.
  if (parts[parts.length - 1] === "") parts.pop();
  return parts;
}

interface Segment {
  kind: "unchanged" | "added" | "removed";
  lines: string[];
}

/** Turn `Change[]` into a flat list of per-line segments. */
function toSegments(changes: Change[]): Segment[] {
  const segments: Segment[] = [];
  for (const change of changes) {
    const lines = splitLines(change.value);
    if (lines.length === 0) continue;
    const kind: Segment["kind"] = change.added ? "added" : change.removed ? "removed" : "unchanged";
    segments.push({ kind, lines });
  }
  return segments;
}

/**
 * Group adjacent change segments into hunks. Two change segments belong to
 * the same hunk when the unchanged run between them has at most
 * `2 * contextLines` lines.
 */
interface HunkGroup {
  /** Indices in `segments` that belong to this hunk (change segments only). */
  changeIndices: number[];
  /** Index of the last unchanged segment before the hunk, or -1. */
  prevIndex: number;
  /** Index of the first unchanged segment after the hunk, or -1. */
  nextIndex: number;
}

function groupHunks(segments: Segment[], contextLines: number): HunkGroup[] {
  const groups: HunkGroup[] = [];
  let current: HunkGroup | null = null;
  let lastUnchangedIndex = -1;
  let pendingUnchanged: { index: number; size: number } | null = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.kind === "unchanged") {
      if (current && pendingUnchanged === null) {
        pendingUnchanged = { index: i, size: seg.lines.length };
      } else if (current && pendingUnchanged !== null) {
        // Consecutive unchanged segments — merge sizes and keep earliest index.
        pendingUnchanged = { index: pendingUnchanged.index, size: pendingUnchanged.size + seg.lines.length };
      }
      lastUnchangedIndex = i;
      continue;
    }

    if (!current) {
      current = { changeIndices: [i], prevIndex: lastUnchangedIndex, nextIndex: -1 };
      groups.push(current);
      pendingUnchanged = null;
      continue;
    }

    if (pendingUnchanged !== null) {
      if (pendingUnchanged.size <= 2 * contextLines) {
        // Absorb the short unchanged run into the current hunk by keeping it
        // open. We still track its index in case we need it later.
        current.changeIndices.push(i);
        pendingUnchanged = null;
      } else {
        current.nextIndex = pendingUnchanged.index;
        current = { changeIndices: [i], prevIndex: lastUnchangedIndex, nextIndex: -1 };
        groups.push(current);
        pendingUnchanged = null;
      }
    } else {
      current.changeIndices.push(i);
    }
  }

  if (current && pendingUnchanged !== null) {
    current.nextIndex = pendingUnchanged.index;
  } else if (current) {
    current.nextIndex = -1;
  }

  return groups;
}

function buildLines(segments: Segment[], changeIndices: number[]): {
  lines: HunkLine[];
  startOldLine: number;
  startNewLine: number;
  splittable: boolean;
} {
  // Compute the old/new line-numbers where this hunk starts by counting lines
  // in all preceding segments.
  const firstIdx = changeIndices[0];
  let oldLine = 1;
  let newLine = 1;
  for (let i = 0; i < firstIdx; i++) {
    const s = segments[i];
    if (s.kind === "unchanged") {
      oldLine += s.lines.length;
      newLine += s.lines.length;
    } else if (s.kind === "removed") {
      oldLine += s.lines.length;
    } else {
      newLine += s.lines.length;
    }
  }

  const out: HunkLine[] = [];
  let oldNo = oldLine;
  let newNo = newLine;
  let addedCount = 0;
  let removedCount = 0;

  for (const idx of changeIndices) {
    const seg = segments[idx];
    if (seg.kind === "unchanged") {
      for (const text of seg.lines) {
        out.push({ kind: "unchanged", text, oldLineNo: oldNo, newLineNo: newNo });
        oldNo += 1;
        newNo += 1;
      }
    } else if (seg.kind === "removed") {
      for (const text of seg.lines) {
        out.push({ kind: "removed", text, oldLineNo: oldNo });
        oldNo += 1;
        removedCount += 1;
      }
    } else {
      for (const text of seg.lines) {
        out.push({ kind: "added", text, newLineNo: newNo });
        newNo += 1;
        addedCount += 1;
      }
    }
  }

  const splittable = (addedCount === 0 && removedCount > 0)
    || (removedCount === 0 && addedCount > 0)
    || (addedCount > 0 && addedCount === removedCount);

  return { lines: out, startOldLine: oldLine, startNewLine: newLine, splittable };
}

function takeContextBefore(seg: Segment | undefined, contextLines: number): string[] {
  if (!seg || seg.kind !== "unchanged") return [];
  if (seg.lines.length <= contextLines) return [...seg.lines];
  return seg.lines.slice(seg.lines.length - contextLines);
}

function takeContextAfter(seg: Segment | undefined, contextLines: number): string[] {
  if (!seg || seg.kind !== "unchanged") return [];
  if (seg.lines.length <= contextLines) return [...seg.lines];
  return seg.lines.slice(0, contextLines);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the hunk-level diff between `oldText` and `newText`. Each hunk
 * groups one or more change blocks with up to `contextLines` lines of
 * surrounding unchanged context. Identical inputs yield an empty array.
 */
export function computeHunks(oldText: string, newText: string, contextLines = 3): Hunk[] {
  if (oldText === newText) return [];
  const changes = diffLines(oldText, newText);
  const segments = toSegments(changes);
  const groups = groupHunks(segments, contextLines);

  return groups.map((group, index): Hunk => {
    const { lines, startOldLine, startNewLine, splittable } = buildLines(segments, group.changeIndices);
    return {
      id: `hunk-${index}`,
      startOldLine,
      startNewLine,
      lines,
      contextBefore: takeContextBefore(segments[group.prevIndex], contextLines),
      contextAfter: takeContextAfter(segments[group.nextIndex], contextLines),
      splittable,
    };
  });
}

// ── Apply Decisions ──────────────────────────────────────────────────────────

interface ApplyArgs {
  oldText: string;
  newText: string;
  hunks: Hunk[];
  hunkDecisions: Map<string, HunkDecision>;
  lineDecisions: Map<string, Map<number, boolean>>;
}

/**
 * Reconstruct the merged text given per-hunk (and per-line) accept/reject
 * decisions. Unchanged regions are always copied verbatim. A `pending` or
 * `rejected` decision keeps the old side; `accepted` keeps the new side.
 * When a `lineDecisions` entry exists for a splittable hunk, it takes
 * precedence on a per-line basis.
 *
 * Trailing-newline semantics: if both inputs end with `\n`, the output does;
 * if neither does, the output does not; otherwise the side that "won"
 * (accepted-any vs not) wins.
 */
export function applyDecisions(args: ApplyArgs): string {
  const { oldText, newText, hunks, hunkDecisions, lineDecisions } = args;
  const changes = diffLines(oldText, newText);
  const segments = toSegments(changes);
  const groups = groupHunks(segments, 3);

  // Map segment index → hunk id, so we can look up decisions inline while
  // walking the flat segment list.
  const segmentToHunkId = new Map<number, string>();
  groups.forEach((group, index) => {
    const hunk = hunks[index];
    if (!hunk) return;
    for (const segIdx of group.changeIndices) {
      segmentToHunkId.set(segIdx, hunk.id);
    }
  });

  const outLines: string[] = [];
  const emittedHunks = new Set<string>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.kind === "unchanged") {
      // Emit verbatim, unless this unchanged segment is interior to a hunk
      // (i.e. a short run absorbed into a group). Interior unchanged
      // segments have a hunk-id entry by virtue of being in `changeIndices`.
      const hunkId = segmentToHunkId.get(i);
      if (!hunkId) {
        for (const line of seg.lines) outLines.push(line);
      } else {
        // Interior to a hunk — emit verbatim regardless of decision (it's
        // unchanged on both sides).
        for (const line of seg.lines) outLines.push(line);
      }
      continue;
    }

    const hunkId = segmentToHunkId.get(i);
    if (!hunkId) {
      // Defensive: a change segment with no hunk should not happen. Emit
      // the removed side to keep the old text intact.
      if (seg.kind === "removed") {
        for (const line of seg.lines) outLines.push(line);
      }
      continue;
    }

    if (emittedHunks.has(hunkId)) continue;
    emittedHunks.add(hunkId);

    const hunkIndex = hunks.findIndex((h) => h.id === hunkId);
    const hunk = hunks[hunkIndex];
    const group = groups[hunkIndex];
    const decision = hunkDecisions.get(hunkId) ?? "pending";
    const overrides = lineDecisions.get(hunkId);

    if (hunk.splittable && overrides && overrides.size > 0) {
      emitSplittable(hunk, overrides, outLines);
    } else {
      emitWholeHunk(segments, group.changeIndices, decision, outLines);
    }
  }

  const base = outLines.join("\n");
  const oldEndsWithNewline = oldText.endsWith("\n");
  const newEndsWithNewline = newText.endsWith("\n");
  if (outLines.length === 0) {
    // If both inputs are empty-ish, match the dominant trailing-newline.
    if (oldEndsWithNewline && newEndsWithNewline) return "\n";
    return "";
  }
  if (oldEndsWithNewline && newEndsWithNewline) return `${base}\n`;
  if (!oldEndsWithNewline && !newEndsWithNewline) return base;
  const anyAccepted = Array.from(hunkDecisions.values()).some((d) => d === "accepted");
  const preserveTrailing = anyAccepted ? newEndsWithNewline : oldEndsWithNewline;
  return preserveTrailing ? `${base}\n` : base;
}

function emitWholeHunk(
  segments: Segment[],
  changeIndices: number[],
  decision: HunkDecision,
  out: string[],
) {
  const accept = decision === "accepted";
  for (const idx of changeIndices) {
    const seg = segments[idx];
    if (seg.kind === "unchanged") {
      // Already emitted inline by the caller.
      continue;
    }
    if (accept && seg.kind === "added") {
      for (const line of seg.lines) out.push(line);
    } else if (!accept && seg.kind === "removed") {
      for (const line of seg.lines) out.push(line);
    }
  }
}

function emitSplittable(
  hunk: Hunk,
  overrides: Map<number, boolean>,
  out: string[],
) {
  const removedLines = hunk.lines.filter((l) => l.kind === "removed");
  const addedLines = hunk.lines.filter((l) => l.kind === "added");
  const pureAdd = removedLines.length === 0;
  const pureRemove = addedLines.length === 0;

  if (pureAdd) {
    hunk.lines.forEach((line, idx) => {
      if (line.kind !== "added") return;
      const accepted = overrides.get(idx) ?? false;
      if (accepted) out.push(line.text);
    });
    return;
  }
  if (pureRemove) {
    hunk.lines.forEach((line, idx) => {
      if (line.kind !== "removed") return;
      const accepted = overrides.get(idx) ?? false;
      if (!accepted) out.push(line.text);
    });
    return;
  }

  // Equal-count replacement: pair removed[i] with added[i]. Override keys
  // reference the removed-line index in `hunk.lines`.
  const count = addedLines.length;
  const removedIndices: number[] = [];
  hunk.lines.forEach((line, idx) => {
    if (line.kind === "removed") removedIndices.push(idx);
  });
  for (let i = 0; i < count; i++) {
    const removedIdx = removedIndices[i];
    const accepted = overrides.get(removedIdx) ?? false;
    if (accepted) out.push(addedLines[i].text);
    else out.push(removedLines[i].text);
  }
}

