// ─── Diff Computation ───────────────────────────────────────────────────────
// Wraps `diffLines` from the `diff` package and turns its flat change list
// into `Hunk[]` at **line granularity** — one hunk per line-level change so
// accept/reject decisions are per-line. A paired replacement between a
// removed block (N lines) and an adjacent added block (M lines) emits
// `min(N, M)` "modified" hunks (each holding one old + one new line) plus
// one hunk per leftover add-only or remove-only line.
//
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
 * A `LineHunkPlan` is the pre-computed recipe for one emitted hunk. It carries
 * enough information for both `computeHunks` (to build the public `Hunk`
 * object) and `applyDecisions` (to know which old/new lines the hunk owns).
 */
interface LineHunkPlan {
  kind: "modified" | "added" | "removed";
  /** Old-line text + its 1-based line number (when present). */
  oldText?: string;
  oldLineNo?: number;
  /** New-line text + its 1-based line number (when present). */
  newText?: string;
  newLineNo?: number;
  /** Lines of unchanged context immediately before/after this hunk. */
  contextBefore: string[];
  contextAfter: string[];
}

/**
 * Walk segments pairwise and produce one `LineHunkPlan` per line-level change.
 * Pairing rule for `[removed seg, added seg]` adjacency:
 *   - The first `min(R, A)` lines pair 1:1 → `modified` hunks.
 *   - Leftover removed lines (when R > A) → individual `removed` hunks.
 *   - Leftover added lines (when A > R) → individual `added` hunks.
 * Non-adjacent pure-add / pure-remove segments also split per line.
 */
function planLineHunks(segments: Segment[], contextLines: number): LineHunkPlan[] {
  const plans: LineHunkPlan[] = [];

  // Pre-compute the old/new line number at the start of every segment so we
  // can stamp each hunk with the correct `oldLineNo` / `newLineNo`.
  const startOldByIdx: number[] = [];
  const startNewByIdx: number[] = [];
  {
    let oldNo = 1;
    let newNo = 1;
    for (let i = 0; i < segments.length; i++) {
      startOldByIdx.push(oldNo);
      startNewByIdx.push(newNo);
      const s = segments[i];
      if (s.kind === "unchanged") {
        oldNo += s.lines.length;
        newNo += s.lines.length;
      } else if (s.kind === "removed") {
        oldNo += s.lines.length;
      } else {
        newNo += s.lines.length;
      }
    }
  }

  // Context helper — takes the last `contextLines` of the unchanged segment
  // immediately preceding index `i`, or all of it if shorter. Returns [] when
  // there is no preceding unchanged segment or it is not unchanged.
  const takeBefore = (i: number): string[] => {
    const prev = segments[i - 1];
    if (!prev || prev.kind !== "unchanged") return [];
    if (prev.lines.length <= contextLines) return [...prev.lines];
    return prev.lines.slice(prev.lines.length - contextLines);
  };
  const takeAfter = (i: number): string[] => {
    const next = segments[i + 1];
    if (!next || next.kind !== "unchanged") return [];
    if (next.lines.length <= contextLines) return [...next.lines];
    return next.lines.slice(0, contextLines);
  };

  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (seg.kind === "unchanged") {
      i += 1;
      continue;
    }

    // Detect `[removed, added]` adjacency to emit paired-modify hunks first.
    if (seg.kind === "removed") {
      const removedSeg = seg;
      const next = segments[i + 1];
      if (next && next.kind === "added") {
        const removedLines = removedSeg.lines;
        const addedLines = next.lines;
        const pairCount = Math.min(removedLines.length, addedLines.length);
        const removedStart = startOldByIdx[i];
        const addedStart = startNewByIdx[i + 1];
        const ctxBefore = takeBefore(i);
        const ctxAfter = takeAfter(i + 1);

        // Paired-modify hunks (1 old + 1 new each).
        for (let k = 0; k < pairCount; k++) {
          plans.push({
            kind: "modified",
            oldText: removedLines[k],
            oldLineNo: removedStart + k,
            newText: addedLines[k],
            newLineNo: addedStart + k,
            // Only the first hunk of the pair gets ctxBefore; only the last
            // of the whole removed+added sequence gets ctxAfter.
            contextBefore: k === 0 ? ctxBefore : [],
            contextAfter: [],
          });
        }

        // Leftover removed lines (R > A).
        for (let k = pairCount; k < removedLines.length; k++) {
          plans.push({
            kind: "removed",
            oldText: removedLines[k],
            oldLineNo: removedStart + k,
            contextBefore: pairCount === 0 && k === pairCount ? ctxBefore : [],
            contextAfter: [],
          });
        }
        // Leftover added lines (A > R).
        for (let k = pairCount; k < addedLines.length; k++) {
          plans.push({
            kind: "added",
            newText: addedLines[k],
            newLineNo: addedStart + k,
            contextBefore: pairCount === 0 && k === pairCount ? ctxBefore : [],
            contextAfter: [],
          });
        }

        // Stamp the final hunk of this group with the after-context.
        if (plans.length > 0) {
          plans[plans.length - 1].contextAfter = ctxAfter;
        }

        i += 2;
        continue;
      }

      // Pure removal.
      const removedStart = startOldByIdx[i];
      const ctxBefore = takeBefore(i);
      const ctxAfter = takeAfter(i);
      for (let k = 0; k < removedSeg.lines.length; k++) {
        plans.push({
          kind: "removed",
          oldText: removedSeg.lines[k],
          oldLineNo: removedStart + k,
          contextBefore: k === 0 ? ctxBefore : [],
          contextAfter: k === removedSeg.lines.length - 1 ? ctxAfter : [],
        });
      }
      i += 1;
      continue;
    }

    // seg.kind === "added" — pure insertion.
    const addedStart = startNewByIdx[i];
    const ctxBefore = takeBefore(i);
    const ctxAfter = takeAfter(i);
    for (let k = 0; k < seg.lines.length; k++) {
      plans.push({
        kind: "added",
        newText: seg.lines[k],
        newLineNo: addedStart + k,
        contextBefore: k === 0 ? ctxBefore : [],
        contextAfter: k === seg.lines.length - 1 ? ctxAfter : [],
      });
    }
    i += 1;
  }

  return plans;
}

function planToHunk(plan: LineHunkPlan, index: number): Hunk {
  const lines: HunkLine[] = [];
  if (plan.kind === "modified") {
    lines.push({ kind: "removed", text: plan.oldText ?? "", oldLineNo: plan.oldLineNo });
    lines.push({ kind: "added", text: plan.newText ?? "", newLineNo: plan.newLineNo });
  } else if (plan.kind === "removed") {
    lines.push({ kind: "removed", text: plan.oldText ?? "", oldLineNo: plan.oldLineNo });
  } else {
    lines.push({ kind: "added", text: plan.newText ?? "", newLineNo: plan.newLineNo });
  }

  return {
    id: `hunk-${index}`,
    startOldLine: plan.oldLineNo ?? (plan.newLineNo ?? 1),
    startNewLine: plan.newLineNo ?? (plan.oldLineNo ?? 1),
    lines,
    contextBefore: plan.contextBefore,
    contextAfter: plan.contextAfter,
    // Per-line expansion UI is a no-op for 1-line hunks, but we keep the flag
    // set to `true` so existing callers that branch on `splittable` continue
    // to behave (trivially per-line already).
    splittable: true,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the **per-line** hunk diff between `oldText` and `newText`. Every
 * hunk represents a single line-level change (one added line, one removed
 * line, or one paired modify of old+new). Identical inputs yield an empty
 * array.
 *
 * `contextLines` is still honored for the `contextBefore` / `contextAfter`
 * arrays on each hunk; neighbouring hunks may share overlapping context.
 */
export function computeHunks(oldText: string, newText: string, contextLines = 3): Hunk[] {
  if (oldText === newText) return [];
  const changes = diffLines(oldText, newText);
  const segments = toSegments(changes);
  const plans = planLineHunks(segments, contextLines);
  return plans.map((plan, idx) => planToHunk(plan, idx));
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
 *
 * Per-line overrides still apply to modified hunks: an override at line
 * index 0 (the old line) controls whether that pair's new side wins.
 *
 * Trailing-newline semantics: if both inputs end with `\n`, the output does;
 * if neither does, the output does not; otherwise the side that "won"
 * (accepted-any vs not) wins.
 */
export function applyDecisions(args: ApplyArgs): string {
  const { oldText, newText, hunks, hunkDecisions, lineDecisions } = args;
  const changes = diffLines(oldText, newText);
  const segments = toSegments(changes);

  // Walk segments in order and, for each change segment, consume the next N
  // hunks that belong to it. The order in which `planLineHunks` produces
  // hunks mirrors the segment walk, so we can consume in a strict queue.
  let hunkCursor = 0;
  const outLines: string[] = [];

  const applyHunk = (hunk: Hunk): void => {
    const decision = hunkDecisions.get(hunk.id) ?? "pending";
    const overrides = lineDecisions.get(hunk.id);

    const removedLines = hunk.lines.filter((l) => l.kind === "removed");
    const addedLines = hunk.lines.filter((l) => l.kind === "added");
    const isModified = removedLines.length === 1 && addedLines.length === 1;
    const isPureRemove = removedLines.length === 1 && addedLines.length === 0;
    const isPureAdd = removedLines.length === 0 && addedLines.length === 1;

    if (isModified) {
      // Override at index 0 (the removed line) controls whether we keep the
      // new or old text. Fall back to the hunk-level decision.
      const override = overrides?.get(0);
      const accepted = override !== undefined ? override : decision === "accepted";
      outLines.push(accepted ? addedLines[0].text : removedLines[0].text);
      return;
    }
    if (isPureRemove) {
      const override = overrides?.get(0);
      const accepted = override !== undefined ? override : decision === "accepted";
      // Accept deletion → drop the line. Reject → keep the old line.
      if (!accepted) outLines.push(removedLines[0].text);
      return;
    }
    if (isPureAdd) {
      const override = overrides?.get(0);
      const accepted = override !== undefined ? override : decision === "accepted";
      if (accepted) outLines.push(addedLines[0].text);
      return;
    }
    // Defensive fallback — should not happen with per-line hunks.
    if (decision === "accepted") {
      for (const l of addedLines) outLines.push(l.text);
    } else {
      for (const l of removedLines) outLines.push(l.text);
    }
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.kind === "unchanged") {
      for (const line of seg.lines) outLines.push(line);
      continue;
    }

    if (seg.kind === "removed") {
      const next = segments[i + 1];
      if (next && next.kind === "added") {
        const pairCount = Math.min(seg.lines.length, next.lines.length);
        const remainingRemoved = seg.lines.length - pairCount;
        const remainingAdded = next.lines.length - pairCount;
        const totalHunks = pairCount + remainingRemoved + remainingAdded;
        for (let k = 0; k < totalHunks; k++) {
          const hunk = hunks[hunkCursor++];
          if (!hunk) break;
          applyHunk(hunk);
        }
        i += 1; // skip the added segment as we consumed it
        continue;
      }
      for (let k = 0; k < seg.lines.length; k++) {
        const hunk = hunks[hunkCursor++];
        if (!hunk) break;
        applyHunk(hunk);
      }
      continue;
    }

    // seg.kind === "added"
    for (let k = 0; k < seg.lines.length; k++) {
      const hunk = hunks[hunkCursor++];
      if (!hunk) break;
      applyHunk(hunk);
    }
  }

  const base = outLines.join("\n");
  const oldEndsWithNewline = oldText.endsWith("\n");
  const newEndsWithNewline = newText.endsWith("\n");
  if (outLines.length === 0) {
    if (oldEndsWithNewline && newEndsWithNewline) return "\n";
    return "";
  }
  if (oldEndsWithNewline && newEndsWithNewline) return `${base}\n`;
  if (!oldEndsWithNewline && !newEndsWithNewline) return base;
  const anyAccepted = Array.from(hunkDecisions.values()).some((d) => d === "accepted");
  const preserveTrailing = anyAccepted ? newEndsWithNewline : oldEndsWithNewline;
  return preserveTrailing ? `${base}\n` : base;
}
