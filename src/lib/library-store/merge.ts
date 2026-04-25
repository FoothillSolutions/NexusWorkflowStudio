export type MergeConflictType = "text_conflict" | "delete_edit" | "add_add";

export interface MergeConflict {
  conflictType: MergeConflictType;
  ancestor: string | null;
  base: string | null;
  branch: string | null;
}

export interface ThreeWayMergeResult {
  content: string;
  conflicts: MergeConflict[];
  cleanlyMerged: boolean;
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.split(/\r?\n/);
}

function joinLines(lines: string[]): string {
  return lines.join("\n");
}

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }
  return dp;
}

interface DiffOp {
  type: "equal" | "insert" | "delete" | "replace";
  ancestorStart: number;
  ancestorEnd: number;
  branchStart: number;
  branchEnd: number;
}

function diff(a: string[], b: string[]): DiffOp[] {
  const dp = lcs(a, b);
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  let ancestorStart = 0;
  let branchStart = 0;
  let currentType: "equal" | "diff" | null = null;

  const flush = (type: "equal" | "diff", aEnd: number, bEnd: number): void => {
    if (currentType === null) return;
    if (currentType === "equal") {
      ops.push({ type: "equal", ancestorStart, ancestorEnd: aEnd, branchStart, branchEnd: bEnd });
    } else {
      const aLen = aEnd - ancestorStart;
      const bLen = bEnd - branchStart;
      let opType: "insert" | "delete" | "replace";
      if (aLen === 0) opType = "insert";
      else if (bLen === 0) opType = "delete";
      else opType = "replace";
      ops.push({ type: opType, ancestorStart, ancestorEnd: aEnd, branchStart, branchEnd: bEnd });
    }
    void type;
  };

  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      if (currentType !== "equal") {
        flush("equal", i, j);
        currentType = "equal";
        ancestorStart = i;
        branchStart = j;
      }
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) {
      if (currentType !== "diff") {
        flush("diff", i, j);
        currentType = "diff";
        ancestorStart = i;
        branchStart = j;
      }
      j++;
    } else {
      if (currentType !== "diff") {
        flush("diff", i, j);
        currentType = "diff";
        ancestorStart = i;
        branchStart = j;
      }
      i++;
    }
  }
  flush(currentType === "equal" ? "equal" : "diff", i, j);
  return ops;
}

export function threeWayTextMerge(
  ancestor: string,
  theirs: string,
  yours: string,
): ThreeWayMergeResult {
  const ancestorLines = splitLines(ancestor);
  const theirsLines = splitLines(theirs);
  const yoursLines = splitLines(yours);

  if (theirs === yours) {
    return { content: theirs, conflicts: [], cleanlyMerged: true };
  }

  if (ancestor === theirs) {
    return { content: yours, conflicts: [], cleanlyMerged: true };
  }
  if (ancestor === yours) {
    return { content: theirs, conflicts: [], cleanlyMerged: true };
  }

  const theirsOps = diff(ancestorLines, theirsLines);
  const yoursOps = diff(ancestorLines, yoursLines);

  const ancestorLen = ancestorLines.length;
  const theirsChanged = new Array<boolean>(ancestorLen).fill(false);
  const yoursChanged = new Array<boolean>(ancestorLen).fill(false);

  const theirsReplacement = new Map<number, string[]>();
  const yoursReplacement = new Map<number, string[]>();

  for (const op of theirsOps) {
    if (op.type === "equal") continue;
    const repl = theirsLines.slice(op.branchStart, op.branchEnd);
    theirsReplacement.set(op.ancestorStart, repl);
    if (op.ancestorEnd === op.ancestorStart) {
      theirsChanged[op.ancestorStart] = true;
    }
    for (let k = op.ancestorStart; k < op.ancestorEnd; k++) {
      theirsChanged[k] = true;
    }
  }
  for (const op of yoursOps) {
    if (op.type === "equal") continue;
    const repl = yoursLines.slice(op.branchStart, op.branchEnd);
    yoursReplacement.set(op.ancestorStart, repl);
    if (op.ancestorEnd === op.ancestorStart) {
      yoursChanged[op.ancestorStart] = true;
    }
    for (let k = op.ancestorStart; k < op.ancestorEnd; k++) {
      yoursChanged[k] = true;
    }
  }

  const conflicts: MergeConflict[] = [];
  let hasConflict = false;
  for (let k = 0; k < ancestorLen; k++) {
    if (theirsChanged[k] && yoursChanged[k]) {
      hasConflict = true;
      break;
    }
  }
  for (const start of theirsReplacement.keys()) {
    if (yoursReplacement.has(start)) {
      const t = theirsReplacement.get(start)!;
      const y = yoursReplacement.get(start)!;
      if (t.join("\n") !== y.join("\n")) {
        hasConflict = true;
      }
    }
  }

  if (hasConflict) {
    const block = [
      "<<<<<<< yours",
      yours,
      "=======",
      theirs,
      ">>>>>>> theirs",
    ].join("\n");
    conflicts.push({
      conflictType: ancestor === "" ? "add_add" : "text_conflict",
      ancestor,
      base: theirs,
      branch: yours,
    });
    return { content: block, conflicts, cleanlyMerged: false };
  }

  const result: string[] = [];
  for (let k = 0; k < ancestorLen; k++) {
    if (theirsReplacement.has(k)) {
      const repl = theirsReplacement.get(k)!;
      result.push(...repl);
      const op = theirsOps.find((o) => o.ancestorStart === k);
      if (op && op.ancestorEnd > op.ancestorStart) {
        k = op.ancestorEnd - 1;
        continue;
      }
    } else if (yoursReplacement.has(k)) {
      const repl = yoursReplacement.get(k)!;
      result.push(...repl);
      const op = yoursOps.find((o) => o.ancestorStart === k);
      if (op && op.ancestorEnd > op.ancestorStart) {
        k = op.ancestorEnd - 1;
        continue;
      }
    } else {
      result.push(ancestorLines[k]);
    }
  }
  if (theirsReplacement.has(ancestorLen)) {
    result.push(...theirsReplacement.get(ancestorLen)!);
  }
  if (yoursReplacement.has(ancestorLen) && !theirsReplacement.has(ancestorLen)) {
    result.push(...yoursReplacement.get(ancestorLen)!);
  }

  return { content: joinLines(result), conflicts: [], cleanlyMerged: true };
}
