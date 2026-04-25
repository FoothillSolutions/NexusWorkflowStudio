// ─── Side-by-side Alignment ─────────────────────────────────────────────────
// Turns per-line `Hunk[]` (plus surrounding unchanged context) into a flat
// list of row pairs `{ old, new, hunkId?, kind }` that the side-by-side diff
// view can render as a single aligned grid.
//
// Alignment rules (mirrors the hunk-planning rules in `compute.ts`):
//   - An unchanged line emits a single pair with `old` and `new` both set to
//     the same text; both columns stay in lockstep.
//   - Each `modified` hunk (one removed + one added line) emits a single row
//     with both sides populated. `kind` is `modified` unless the texts match.
//   - Each `added` hunk emits a row with `old === null`, `kind === "added"`.
//   - Each `removed` hunk emits a row with `new === null`, `kind === "removed"`.
//
// Because hunks are line-granular, there is no padding needed anymore —
// the hunk list itself already encodes 1:1 pairing with leftover one-sided
// rows.
//
// This module is pure — no DOM — so it can be exercised by `bun test`.

import { diffLines, type Change } from "diff";
import type { Hunk, HunkLine } from "./types";

export interface AlignedRow {
  /** Old-side line, or null when the new side is an insertion at this row. */
  old: HunkLine | null;
  /** New-side line, or null when the old side is a deletion at this row. */
  new: HunkLine | null;
  /** Present when this row belongs to a hunk; otherwise this is pure context. */
  hunkId?: string;
  /**
   * Row classification:
   *  - `unchanged` — both old and new present with the same text
   *  - `added` — pure insertion (old is null)
   *  - `removed` — pure deletion (new is null)
   *  - `modified` — both old and new present but text differs (paired replacement)
   */
  kind: "unchanged" | "added" | "removed" | "modified";
}

// ── Internal helpers (mirror compute.ts semantics for consistency) ──────────

function splitLines(value: string): string[] {
  if (value === "") return [];
  const parts = value.split("\n");
  if (parts[parts.length - 1] === "") parts.pop();
  return parts;
}

interface Segment {
  kind: "unchanged" | "added" | "removed";
  lines: string[];
}

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

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Produce a flat list of aligned `AlignedRow`s for side-by-side rendering.
 * The caller passes `oldText` / `newText` and the already-computed `hunks` so
 * the row-level `hunkId` stays stable with whatever IDs the dialog stores
 * decisions against.
 *
 * With per-line hunks, the walk is trivial: every hunk → exactly one row.
 */
export function alignRows(oldText: string, newText: string, hunks: Hunk[]): AlignedRow[] {
  if (oldText === newText) {
    const lines = splitLines(oldText);
    return lines.map((text, i) => ({
      old: { kind: "unchanged", text, oldLineNo: i + 1, newLineNo: i + 1 },
      new: { kind: "unchanged", text, oldLineNo: i + 1, newLineNo: i + 1 },
      kind: "unchanged",
    }));
  }

  const changes = diffLines(oldText, newText);
  const segments = toSegments(changes);

  const rows: AlignedRow[] = [];
  let oldNo = 1;
  let newNo = 1;
  let hunkCursor = 0;

  const emitHunkRow = (hunk: Hunk | undefined) => {
    if (!hunk) return;
    const removed = hunk.lines.find((l) => l.kind === "removed");
    const added = hunk.lines.find((l) => l.kind === "added");
    if (removed && added) {
      const kind: AlignedRow["kind"] = removed.text === added.text ? "unchanged" : "modified";
      rows.push({ old: removed, new: added, hunkId: hunk.id, kind });
      oldNo += 1;
      newNo += 1;
      return;
    }
    if (removed) {
      rows.push({ old: removed, new: null, hunkId: hunk.id, kind: "removed" });
      oldNo += 1;
      return;
    }
    if (added) {
      rows.push({ old: null, new: added, hunkId: hunk.id, kind: "added" });
      newNo += 1;
      return;
    }
  };

  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];

    if (seg.kind === "unchanged") {
      for (const text of seg.lines) {
        rows.push({
          old: { kind: "unchanged", text, oldLineNo: oldNo, newLineNo: newNo },
          new: { kind: "unchanged", text, oldLineNo: oldNo, newLineNo: newNo },
          kind: "unchanged",
        });
        oldNo += 1;
        newNo += 1;
      }
      i += 1;
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
          emitHunkRow(hunks[hunkCursor++]);
        }
        i += 2;
        continue;
      }
      for (let k = 0; k < seg.lines.length; k++) {
        emitHunkRow(hunks[hunkCursor++]);
      }
      i += 1;
      continue;
    }

    // seg.kind === "added"
    for (let k = 0; k < seg.lines.length; k++) {
      emitHunkRow(hunks[hunkCursor++]);
    }
    i += 1;
  }

  return rows;
}
