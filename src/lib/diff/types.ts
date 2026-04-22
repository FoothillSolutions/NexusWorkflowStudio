// ─── Diff Review Types ──────────────────────────────────────────────────────
// Shared types for the hunk-level accept/reject diff review feature.
// See `compute.ts` for the helpers that produce `Hunk[]` and apply decisions.

export type ChangeKind = "unchanged" | "added" | "removed";

export interface HunkLine {
  kind: ChangeKind;
  text: string;
  oldLineNo?: number;
  newLineNo?: number;
}

export interface Hunk {
  id: string;
  startOldLine: number;
  startNewLine: number;
  /** Only the changed lines belonging to this hunk (no context). */
  lines: HunkLine[];
  /** Up to N lines of unchanged context immediately before the hunk. */
  contextBefore: string[];
  /** Up to N lines of unchanged context immediately after the hunk. */
  contextAfter: string[];
  /**
   * True when the hunk is a pure addition, pure removal, or a line-for-line
   * replacement with equal add/remove counts. Mixed-length replacements are
   * not splittable (line-level accept is ambiguous there).
   */
  splittable: boolean;
}

export type HunkDecision = "pending" | "accepted" | "rejected";

export interface LineDecision {
  hunkId: string;
  lineIndex: number;
  accepted: boolean;
}
