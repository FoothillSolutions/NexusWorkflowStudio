import type {
  WorkflowJSON,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeData,
  SubWorkflowNodeData,
} from "@/types/workflow";

export type RunNodeStatus = "idle" | "running" | "success" | "skipped";

export interface WorkflowRunStep {
  id: string;
  nodeId: string;
  label: string;
  type: WorkflowNodeData["type"];
  depth: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary: string;
  branchLabel?: string;
  nestedWorkflow?: WorkflowJSON;
}

export interface WorkflowRunRecord {
  id: string;
  workflowName: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: "success";
  steps: WorkflowRunStep[];
  topLevelStepCount: number;
  nestedStepCount: number;
}

const STEP_DURATION_MS = 650;

function readBranchLabel(edge?: WorkflowEdge): string | undefined {
  if (!edge?.sourceHandle) return undefined;
  return edge.sourceHandle.replace(/^branch-/, "").replace(/[-_]/g, " ");
}

function formatNodeSummary(node: WorkflowNode, chosenEdge?: WorkflowEdge): string {
  switch (node.data.type) {
    case "start":
      return "Workflow trigger received and execution started.";
    case "prompt":
      return "Prompt compiled with the latest workflow variables.";
    case "agent":
      return "Agent simulated a structured response and returned control to the graph.";
    case "ask-user":
      return "A user-facing decision point was resolved with the primary option.";
    case "switch":
      return `Switch evaluated the input and selected ${readBranchLabel(chosenEdge) ?? "the default route"}.`;
    case "if-else":
      return `Condition evaluated and continued through ${readBranchLabel(chosenEdge) ?? "the first matching branch"}.`;
    case "sub-workflow":
      return "Nested workflow executed and merged its output back into the parent run.";
    case "end":
      return "Workflow reached a terminal state successfully.";
    case "skill":
      return "Skill node prepared supporting capability metadata.";
    case "document":
      return "Document context was attached to the execution state.";
    case "mcp-tool":
      return "Tool invocation was simulated with the configured parameters.";
    default:
      return "Node completed successfully.";
  }
}

function chooseNextEdge(node: WorkflowNode, outgoingEdges: WorkflowEdge[]): WorkflowEdge | undefined {
  if (outgoingEdges.length <= 1) return outgoingEdges[0];
  const byHandle = [...outgoingEdges].sort((a, b) => (a.sourceHandle ?? "").localeCompare(b.sourceHandle ?? ""));
  if (node.data.type === "if-else" || node.data.type === "switch") {
    return byHandle[0];
  }
  return [...outgoingEdges].sort((a, b) => a.target.localeCompare(b.target))[0];
}

function findStartNode(nodes: WorkflowNode[]): WorkflowNode {
  return nodes.find((node) => node.data.type === "start") ?? nodes[0]!;
}

function buildRunSteps(
  workflow: WorkflowJSON,
  depth: number,
  visited: Set<string>,
  seedTime: number,
  steps: WorkflowRunStep[],
): void {
  const nodeById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const outgoingByNode = workflow.edges.reduce<Map<string, WorkflowEdge[]>>((acc, edge) => {
    const existing = acc.get(edge.source) ?? [];
    existing.push(edge);
    acc.set(edge.source, existing);
    return acc;
  }, new Map());

  let currentNode: WorkflowNode | undefined = findStartNode(workflow.nodes);
  let offset = steps.length;

  while (currentNode && !visited.has(`${depth}:${currentNode.id}`)) {
    visited.add(`${depth}:${currentNode.id}`);
    const startedAtMs = seedTime + offset * STEP_DURATION_MS;
    const completedAtMs = startedAtMs + STEP_DURATION_MS - 120;
    const outgoing = outgoingByNode.get(currentNode.id) ?? [];
    const chosenEdge = chooseNextEdge(currentNode, outgoing);
    const step: WorkflowRunStep = {
      id: `${depth}-${currentNode.id}-${offset}`,
      nodeId: currentNode.id,
      label: currentNode.data.label,
      type: currentNode.data.type,
      depth,
      startedAt: new Date(startedAtMs).toISOString(),
      completedAt: new Date(completedAtMs).toISOString(),
      durationMs: STEP_DURATION_MS - 120,
      summary: formatNodeSummary(currentNode, chosenEdge),
      branchLabel: readBranchLabel(chosenEdge),
    };

    if (currentNode.data.type === "sub-workflow") {
      const data = currentNode.data as SubWorkflowNodeData;
      step.nestedWorkflow = {
        name: currentNode.data.label,
        nodes: data.subNodes,
        edges: data.subEdges,
        ui: workflow.ui,
      };
    }

    steps.push(step);
    offset = steps.length;

    if (currentNode.data.type === "sub-workflow") {
      const data = currentNode.data as SubWorkflowNodeData;
      buildRunSteps(
        {
          name: currentNode.data.label,
          nodes: data.subNodes,
          edges: data.subEdges,
          ui: workflow.ui,
        },
        depth + 1,
        visited,
        seedTime,
        steps,
      );
      offset = steps.length;
    }

    if (currentNode.data.type === "end") break;
    currentNode = chosenEdge ? nodeById.get(chosenEdge.target) : undefined;
  }
}

export function createWorkflowRunRecord(workflow: WorkflowJSON): WorkflowRunRecord {
  const startedAtMs = Date.now();
  const steps: WorkflowRunStep[] = [];
  buildRunSteps(workflow, 0, new Set(), startedAtMs, steps);
  const durationMs = Math.max(steps.length * STEP_DURATION_MS, STEP_DURATION_MS);
  const topLevelStepCount = steps.filter((step) => step.depth === 0).length;
  const nestedStepCount = steps.length - topLevelStepCount;
  return {
    id: `run-${startedAtMs}`,
    workflowName: workflow.name,
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(startedAtMs + durationMs).toISOString(),
    durationMs,
    status: "success",
    steps,
    topLevelStepCount,
    nestedStepCount,
  };
}

export function getNodeStatusMap(
  steps: WorkflowRunStep[],
  playbackIndex: number,
): Record<string, RunNodeStatus> {
  const statuses: Record<string, RunNodeStatus> = {};
  steps.forEach((step, index) => {
    if (index < playbackIndex) statuses[step.nodeId] = "success";
    else if (index === playbackIndex) statuses[step.nodeId] = "running";
    else if (!(step.nodeId in statuses)) statuses[step.nodeId] = "idle";
  });
  return statuses;
}

export function formatRunClock(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

export function formatRunDuration(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(1)}s`;
}
