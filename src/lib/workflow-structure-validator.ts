// ─── Workflow Structure Validator ────────────────────────────────────────────
// Lightweight structural checks that run after AI generation/edit completes.
// Verifies the workflow has a valid path from start to end and that every
// flow node participates in that path. Attachment nodes (skill, document) are
// excluded from flow-reachability since they connect via side-channel handles.

import {
  WorkflowNodeType,
  type WorkflowEdge,
  type WorkflowJSON,
  type WorkflowNode,
} from "@/types/workflow";

export type WorkflowStructuralIssueSeverity = "error" | "warning";

export interface WorkflowStructuralIssue {
  severity: WorkflowStructuralIssueSeverity;
  code:
    | "missing-start"
    | "missing-end"
    | "multiple-start"
    | "multiple-end"
    | "no-path-start-to-end"
    | "unreachable-from-start"
    | "cannot-reach-end"
    | "orphan-attachment";
  message: string;
  nodeIds?: string[];
}

/** Nodes that attach to an agent via side-channel handles, not the main flow. */
const ATTACHMENT_NODE_TYPES = new Set<string>([
  WorkflowNodeType.Skill,
  WorkflowNodeType.Document,
]);

/** Source handles that mark an edge as a side-channel attachment, not flow. */
const ATTACHMENT_SOURCE_HANDLES = new Set(["skill-out", "doc-out"]);

/** Target handles that mark an edge as a side-channel attachment, not flow. */
const ATTACHMENT_TARGET_HANDLES = new Set(["skills", "docs"]);

function nodeType(node: WorkflowNode): string {
  const data = node.data as { type?: string } | undefined;
  return data?.type ?? (node.type as string);
}

function isAttachmentNode(node: WorkflowNode): boolean {
  return ATTACHMENT_NODE_TYPES.has(nodeType(node));
}

function isAttachmentEdge(edge: WorkflowEdge): boolean {
  if (edge.sourceHandle && ATTACHMENT_SOURCE_HANDLES.has(edge.sourceHandle)) return true;
  if (edge.targetHandle && ATTACHMENT_TARGET_HANDLES.has(edge.targetHandle)) return true;
  return false;
}

/** Inspect a workflow for structural problems that would prevent correct execution. */
export function validateWorkflowStructure(workflow: WorkflowJSON): WorkflowStructuralIssue[] {
  const issues: WorkflowStructuralIssue[] = [];
  const nodes = workflow.nodes ?? [];
  const edges = workflow.edges ?? [];

  const starts = nodes.filter((n) => nodeType(n) === WorkflowNodeType.Start);
  const ends = nodes.filter((n) => nodeType(n) === WorkflowNodeType.End);

  if (starts.length === 0) {
    issues.push({
      severity: "error",
      code: "missing-start",
      message: "Workflow has no start node.",
    });
  } else if (starts.length > 1) {
    issues.push({
      severity: "error",
      code: "multiple-start",
      message: `Workflow has ${starts.length} start nodes (expected exactly 1).`,
      nodeIds: starts.map((n) => n.id),
    });
  }

  if (ends.length === 0) {
    issues.push({
      severity: "error",
      code: "missing-end",
      message: "Workflow has no end node.",
    });
  } else if (ends.length > 1) {
    issues.push({
      severity: "error",
      code: "multiple-end",
      message: `Workflow has ${ends.length} end nodes (expected exactly 1).`,
      nodeIds: ends.map((n) => n.id),
    });
  }

  // Without exactly-one start/end we can't do reachability meaningfully.
  if (starts.length !== 1 || ends.length !== 1) return issues;

  const startId = starts[0].id;
  const endId = ends[0].id;

  // Build adjacency over FLOW edges only (attachments excluded).
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (isAttachmentEdge(edge)) continue;
    if (!forward.has(edge.source)) forward.set(edge.source, new Set());
    if (!reverse.has(edge.target)) reverse.set(edge.target, new Set());
    forward.get(edge.source)!.add(edge.target);
    reverse.get(edge.target)!.add(edge.source);
  }

  // BFS forward from start.
  const reachableFromStart = new Set<string>([startId]);
  const forwardQueue: string[] = [startId];
  while (forwardQueue.length > 0) {
    const cur = forwardQueue.shift()!;
    for (const nxt of forward.get(cur) ?? []) {
      if (!reachableFromStart.has(nxt)) {
        reachableFromStart.add(nxt);
        forwardQueue.push(nxt);
      }
    }
  }

  if (!reachableFromStart.has(endId)) {
    issues.push({
      severity: "error",
      code: "no-path-start-to-end",
      message: "No valid path from the start node to the end node.",
      nodeIds: [startId, endId],
    });
  }

  // BFS backward from end.
  const canReachEnd = new Set<string>([endId]);
  const reverseQueue: string[] = [endId];
  while (reverseQueue.length > 0) {
    const cur = reverseQueue.shift()!;
    for (const prv of reverse.get(cur) ?? []) {
      if (!canReachEnd.has(prv)) {
        canReachEnd.add(prv);
        reverseQueue.push(prv);
      }
    }
  }

  // Every flow node (non-attachment) that is not start/end must sit on a
  // start→end path. Report unreachable/dead-end nodes individually.
  const flowNodes = nodes.filter((n) => !isAttachmentNode(n));
  for (const node of flowNodes) {
    if (node.id === startId || node.id === endId) continue;
    if (!reachableFromStart.has(node.id)) {
      issues.push({
        severity: "error",
        code: "unreachable-from-start",
        message: `Node "${node.id}" is not reachable from the start.`,
        nodeIds: [node.id],
      });
    }
    if (!canReachEnd.has(node.id)) {
      issues.push({
        severity: "error",
        code: "cannot-reach-end",
        message: `Node "${node.id}" cannot reach the end.`,
        nodeIds: [node.id],
      });
    }
  }

  // Attachment nodes should be wired to at least one agent-like node.
  for (const node of nodes) {
    if (!isAttachmentNode(node)) continue;
    const hasAttachmentEdge = edges.some(
      (e) => e.source === node.id && isAttachmentEdge(e),
    );
    if (!hasAttachmentEdge) {
      issues.push({
        severity: "warning",
        code: "orphan-attachment",
        message: `Attachment node "${node.id}" is not connected to any agent.`,
        nodeIds: [node.id],
      });
    }
  }

  return issues;
}

/** One-line summary suitable for a toast title. */
export function summarizeStructuralIssues(issues: WorkflowStructuralIssue[]): string {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} structural error${errors > 1 ? "s" : ""}`);
  if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? "s" : ""}`);
  return parts.join(", ");
}
