import type {
  WorkflowJSON,
  WorkflowNode,
  WorkflowEdge,
  PromptNodeData,
  IfElseNodeData,
  SwitchNodeData,
  AskUserNodeData,
  SubWorkflowNodeData,
  SubAgentNodeData,
} from "@/types/workflow";

export interface GeneratedFile {
  path: string;
  content: string;
}

type DiagnosticSeverity = "error" | "warning" | "info";

interface ExportDiagnostic {
  workflowId: string;
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  nodeId?: string;
}

interface UnsupportedNode {
  workflowId: string;
  nodeId: string;
  type: string;
  label: string;
  reason: string;
}

interface RuntimeTransition {
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
}

interface RuntimeWorkflowNode {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
}

interface RuntimeWorkflowDefinition {
  version: 1;
  workflowId: string;
  name: string;
  parentWorkflowId: string | null;
  viaNodeId: string | null;
  startNodeId: string | null;
  nodeCount: number;
  edgeCount: number;
  nodes: RuntimeWorkflowNode[];
  transitions: RuntimeTransition[];
}

interface WorkflowMeta {
  workflowId: string;
  name: string;
  parentWorkflowId: string | null;
  viaNodeId: string | null;
  totalNodes: number;
  reachableNodes: number;
  totalEdges: number;
  reachableEdges: number;
  supportedNodeTypes: string[];
  unsupportedNodes: UnsupportedNode[];
  diagnostics: ExportDiagnostic[];
}

interface CompileTask {
  workflow: WorkflowJSON;
  workflowId: string;
  parentWorkflowId: string | null;
  viaNodeId: string | null;
}

interface CompileBundle {
  rootWorkflowId: string;
  definitions: RuntimeWorkflowDefinition[];
  metas: WorkflowMeta[];
  diagnostics: ExportDiagnostic[];
  unsupportedNodes: UnsupportedNode[];
}

class PiExtensionExportError extends Error {
  diagnostics: ExportDiagnostic[];

  constructor(message: string, diagnostics: ExportDiagnostic[]) {
    super(message);
    this.name = "PiExtensionExportError";
    this.diagnostics = diagnostics;
  }
}

const PHASE1_SUPPORTED = new Set([
  "start",
  "end",
  "prompt",
  "if-else",
  "switch",
  "ask-user",
  "sub-workflow",
]);

const PHASE2_SUPPORTED = new Set(["agent"]);
const PHASE3_PLANNED = new Set(["skill", "document", "mcp-tool"]);

function slugify(raw: string): string {
  return (
    raw
      .replace(/[^a-z0-9\-_ ]/gi, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "workflow"
  );
}

function shortNodeId(nodeId: string): string {
  const safe = nodeId.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return safe.slice(-8) || "node";
}

function filterReachable(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const startIds = nodes.filter((n) => n.data.type === "start").map((n) => n.id);
  if (startIds.length === 0) {
    return { nodes: [...nodes], edges: [...edges] };
  }

  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) adjacency.get(edge.source)?.push(edge.target);

  const visited = new Set<string>();
  const queue = [...startIds];

  for (const id of queue) visited.add(id);

  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const next of adjacency.get(id) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return {
    nodes: nodes.filter((n) => visited.has(n.id)),
    edges: edges.filter((e) => visited.has(e.source) && visited.has(e.target)),
  };
}

function classifyNodeSupport(node: WorkflowNode): { supported: boolean; reason?: string } {
  if (node.data.type === "sub-workflow") {
    const d = node.data as SubWorkflowNodeData;
    if (!Array.isArray(d.subNodes) || d.subNodes.length === 0) {
      return { supported: false, reason: "Sub-workflow has no inner nodes" };
    }
    if (d.mode === "same-context" || d.mode === "agent") {
      return { supported: true };
    }
    return {
      supported: false,
      reason: `Unsupported sub-workflow mode: ${d.mode}`,
    };
  }

  if (PHASE1_SUPPORTED.has(node.data.type)) return { supported: true };
  if (PHASE2_SUPPORTED.has(node.data.type)) return { supported: true };
  if (PHASE3_PLANNED.has(node.data.type)) {
    return {
      supported: false,
      reason: "Resource/integration node is planned for phase-3",
    };
  }

  return { supported: false, reason: "Node type is unsupported for pi-extension profile" };
}

function nodeConfig(node: WorkflowNode, childWorkflowId: string | null): Record<string, unknown> {
  switch (node.data.type) {
    case "prompt": {
      const d = node.data as PromptNodeData;
      return {
        promptText: d.promptText ?? "",
        detectedVariables: d.detectedVariables ?? [],
      };
    }
    case "if-else": {
      const d = node.data as IfElseNodeData;
      return {
        evaluationTarget: d.evaluationTarget ?? "",
        branches: d.branches ?? [],
      };
    }
    case "switch": {
      const d = node.data as SwitchNodeData;
      return {
        evaluationTarget: d.evaluationTarget ?? "",
        branches: d.branches ?? [],
      };
    }
    case "ask-user": {
      const d = node.data as AskUserNodeData;
      return {
        questionText: d.questionText ?? "",
        multipleSelection: d.multipleSelection ?? false,
        aiSuggestOptions: d.aiSuggestOptions ?? false,
        options: d.options ?? [],
      };
    }
    case "sub-workflow": {
      const d = node.data as SubWorkflowNodeData;
      return {
        mode: d.mode,
        workflowId: childWorkflowId,
        nodeCount: d.nodeCount,
      };
    }
    case "agent": {
      const d = node.data as SubAgentNodeData;
      return {
        name: d.name ?? "",
        description: d.description ?? "",
        promptText: d.promptText ?? "",
        model: d.model ?? "inherit",
        memory: d.memory ?? "inherit",
        temperature: d.temperature ?? 0,
        disabledTools: Array.isArray(d.disabledTools) ? d.disabledTools : [],
        parameterMappings: Array.isArray(d.parameterMappings) ? d.parameterMappings : [],
        variableMappings: d.variableMappings ?? {},
      };
    }
    default:
      return {};
  }
}

function validateBranchHandles(
  workflowId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): ExportDiagnostic[] {
  const diagnostics: ExportDiagnostic[] = [];

  for (const node of nodes) {
    const outgoing = edges.filter((e) => e.source === node.id);

    if (node.data.type === "if-else") {
      const handles = new Set(outgoing.map((e) => e.sourceHandle ?? "output"));
      if (!handles.has("true")) {
        diagnostics.push({
          workflowId,
          severity: "warning",
          code: "WF_IFELSE_TRUE_MISSING",
          message: `If/Else node \"${node.data.label || node.id}\" has no 'true' branch edge`,
          nodeId: node.id,
        });
      }
      if (!handles.has("false")) {
        diagnostics.push({
          workflowId,
          severity: "warning",
          code: "WF_IFELSE_FALSE_MISSING",
          message: `If/Else node \"${node.data.label || node.id}\" has no 'false' branch edge`,
          nodeId: node.id,
        });
      }
    }

    if (node.data.type === "switch") {
      if (outgoing.length === 0) {
        diagnostics.push({
          workflowId,
          severity: "warning",
          code: "WF_SWITCH_NO_BRANCH",
          message: `Switch node \"${node.data.label || node.id}\" has no outgoing branches`,
          nodeId: node.id,
        });
      }

      const d = node.data as SwitchNodeData;
      const expected = new Set((d.branches ?? []).map((b) => b.label || "default"));
      const actual = new Set(outgoing.map((e) => e.sourceHandle ?? "output"));

      for (const label of expected) {
        if (!actual.has(label)) {
          diagnostics.push({
            workflowId,
            severity: "warning",
            code: "WF_SWITCH_BRANCH_UNWIRED",
            message: `Switch branch '${label}' on node \"${node.data.label || node.id}\" is not wired`,
            nodeId: node.id,
          });
        }
      }
    }

    if (node.data.type === "ask-user") {
      const d = node.data as AskUserNodeData;
      const handles = new Set(outgoing.map((e) => e.sourceHandle ?? "output"));

      if (d.aiSuggestOptions || d.multipleSelection) {
        if (!handles.has("output")) {
          diagnostics.push({
            workflowId,
            severity: "warning",
            code: "WF_ASK_USER_OUTPUT_MISSING",
            message: `Ask-user node \"${node.data.label || node.id}\" expects an 'output' edge in AI/multi-select mode`,
            nodeId: node.id,
          });
        }
      } else {
        const options = d.options ?? [];
        if (options.length === 0) {
          diagnostics.push({
            workflowId,
            severity: "warning",
            code: "WF_ASK_USER_OPTIONS_EMPTY",
            message: `Ask-user node \"${node.data.label || node.id}\" has no options`,
            nodeId: node.id,
          });
        }

        for (let i = 0; i < options.length; i += 1) {
          const expectedHandle = `option-${i}`;
          if (!handles.has(expectedHandle)) {
            diagnostics.push({
              workflowId,
              severity: "warning",
              code: "WF_ASK_USER_OPTION_UNWIRED",
              message: `Ask-user option '${options[i]?.label || expectedHandle}' is not wired`,
              nodeId: node.id,
            });
          }
        }
      }
    }
  }

  return diagnostics;
}

function compileBundle(workflow: WorkflowJSON): CompileBundle {
  const rootWorkflowId = slugify(workflow.name);
  const queue: CompileTask[] = [
    {
      workflow,
      workflowId: rootWorkflowId,
      parentWorkflowId: null,
      viaNodeId: null,
    },
  ];

  const usedWorkflowIds = new Set<string>();
  const definitions: RuntimeWorkflowDefinition[] = [];
  const metas: WorkflowMeta[] = [];
  const diagnostics: ExportDiagnostic[] = [];
  const unsupportedNodes: UnsupportedNode[] = [];

  while (queue.length > 0) {
    const task = queue.shift()!;

    if (usedWorkflowIds.has(task.workflowId)) continue;
    usedWorkflowIds.add(task.workflowId);

    const { nodes: reachableNodes, edges: reachableEdges } = filterReachable(
      task.workflow.nodes,
      task.workflow.edges
    );

    const workflowDiagnostics: ExportDiagnostic[] = [];

    const startNodes = reachableNodes.filter((n) => n.data.type === "start");
    const endNodes = reachableNodes.filter((n) => n.data.type === "end");

    if (startNodes.length === 0) {
      workflowDiagnostics.push({
        workflowId: task.workflowId,
        severity: "error",
        code: "WF_START_MISSING",
        message: "Workflow has no start node",
      });
    } else if (startNodes.length > 1) {
      workflowDiagnostics.push({
        workflowId: task.workflowId,
        severity: "warning",
        code: "WF_START_MULTIPLE",
        message: `Workflow has ${startNodes.length} start nodes; runtime uses the first reachable one`,
      });
    }

    if (endNodes.length === 0) {
      workflowDiagnostics.push({
        workflowId: task.workflowId,
        severity: "warning",
        code: "WF_END_MISSING",
        message: "Workflow has no end node",
      });
    }

    workflowDiagnostics.push(
      ...validateBranchHandles(task.workflowId, reachableNodes, reachableEdges)
    );

    const runtimeNodes: RuntimeWorkflowNode[] = [];
    const workflowUnsupported: UnsupportedNode[] = [];
    const supportedNodeTypes = new Set<string>();

    for (const node of reachableNodes) {
      let childWorkflowId: string | null = null;

      if (node.data.type === "sub-workflow") {
        const d = node.data as SubWorkflowNodeData;
        if ((d.mode === "same-context" || d.mode === "agent") && Array.isArray(d.subNodes) && d.subNodes.length > 0) {
          let proposal = `${task.workflowId}--${slugify(d.label || node.id)}-${shortNodeId(node.id)}`;
          let suffix = 2;
          while (usedWorkflowIds.has(proposal) || queue.some((q) => q.workflowId === proposal)) {
            proposal = `${task.workflowId}--${slugify(d.label || node.id)}-${shortNodeId(node.id)}-${suffix}`;
            suffix += 1;
          }

          childWorkflowId = proposal;
          queue.push({
            workflow: {
              name: d.label || `${task.workflow.name} / ${node.id}`,
              nodes: d.subNodes ?? [],
              edges: d.subEdges ?? [],
              ui: {
                sidebarOpen: false,
                minimapVisible: false,
                viewport: { x: 0, y: 0, zoom: 1 },
              },
            },
            workflowId: childWorkflowId,
            parentWorkflowId: task.workflowId,
            viaNodeId: node.id,
          });

          if (d.mode === "agent") {
            const { nodes: subReachableNodes } = filterReachable(d.subNodes ?? [], d.subEdges ?? []);
            const interactiveNodes = subReachableNodes.filter((n) => n.data.type === "ask-user");
            if (interactiveNodes.length > 0) {
              const names = interactiveNodes
                .slice(0, 3)
                .map((n) => n.data.label || n.id)
                .join(", ");
              workflowDiagnostics.push({
                workflowId: task.workflowId,
                severity: "warning",
                code: "WF_SUBWORKFLOW_AGENT_INTERACTIVE",
                nodeId: node.id,
                message:
                  `Sub-workflow agent mode contains ${interactiveNodes.length} interactive ask-user node(s)` +
                  ` (${names}${interactiveNodes.length > 3 ? ", ..." : ""}).` +
                  " Child subprocesses cannot pause the parent run for UI interaction; ensure non-interactive execution.",
              });
            }
          }
        }
      }

      const support = classifyNodeSupport(node);
      if (support.supported) {
        supportedNodeTypes.add(node.data.type);
        runtimeNodes.push({
          id: node.id,
          type: node.data.type,
          label: node.data.label || node.id,
          config: nodeConfig(node, childWorkflowId),
        });
      } else {
        const unsupported: UnsupportedNode = {
          workflowId: task.workflowId,
          nodeId: node.id,
          type: node.data.type,
          label: node.data.label || node.id,
          reason: support.reason || "Unsupported node",
        };
        unsupportedNodes.push(unsupported);
        workflowUnsupported.push(unsupported);
        workflowDiagnostics.push({
          workflowId: task.workflowId,
          severity: "error",
          code: "WF_NODE_UNSUPPORTED",
          nodeId: node.id,
          message: `${unsupported.type} node '${unsupported.label}' is unsupported for pi-extension export: ${unsupported.reason}`,
        });
      }
    }

    const includedNodeIds = new Set(runtimeNodes.map((node) => node.id));
    const transitions: RuntimeTransition[] = reachableEdges
      .filter((edge) => includedNodeIds.has(edge.source) && includedNodeIds.has(edge.target))
      .map((edge) => ({
        sourceNodeId: edge.source,
        sourceHandle: (edge.sourceHandle && edge.sourceHandle.trim()) || "output",
        targetNodeId: edge.target,
      }));

    const definition: RuntimeWorkflowDefinition = {
      version: 1,
      workflowId: task.workflowId,
      name: task.workflow.name,
      parentWorkflowId: task.parentWorkflowId,
      viaNodeId: task.viaNodeId,
      startNodeId: startNodes[0]?.id ?? null,
      nodeCount: runtimeNodes.length,
      edgeCount: transitions.length,
      nodes: runtimeNodes,
      transitions,
    };

    const meta: WorkflowMeta = {
      workflowId: task.workflowId,
      name: task.workflow.name,
      parentWorkflowId: task.parentWorkflowId,
      viaNodeId: task.viaNodeId,
      totalNodes: task.workflow.nodes.length,
      reachableNodes: reachableNodes.length,
      totalEdges: task.workflow.edges.length,
      reachableEdges: reachableEdges.length,
      supportedNodeTypes: Array.from(supportedNodeTypes).sort(),
      unsupportedNodes: workflowUnsupported,
      diagnostics: workflowDiagnostics,
    };

    definitions.push(definition);
    metas.push(meta);
    diagnostics.push(...workflowDiagnostics);
  }

  return {
    rootWorkflowId,
    definitions,
    metas,
    diagnostics,
    unsupportedNodes,
  };
}

function buildInstallDoc(rootWorkflowId: string): string {
  return [
    "# Nexus Workflow Runner — Install Guide",
    "",
    "This export package contains a **pi extension** that executes Nexus workflows using a deterministic state machine runtime.",
    "",
    "## 1) Copy files",
    "",
    "Unzip this archive at your project root. It should create/update:",
    "",
    "- `.pi/extensions/nexus-workflow/*`",
    "- `.pi/workflows/*.json`",
    "- `.pi/workflows/*.meta.json`",
    "",
    "## 2) Start or reload pi",
    "",
    "- Start pi in this project directory, or",
    "- Run `/reload` in an existing pi session.",
    "",
    "## 3) Run workflows",
    "",
    "Available commands:",
    "",
    "- `/wf-list`",
    `- \`/wf-run ${rootWorkflowId}\``,
    "- `/wf-status [runId]`",
    "- `/wf-continue <runId> [answer]`",
    "- `/wf-cancel <runId>`",
    "- `/wf-clear`",
    "",
    "Optional tool:",
    "",
    "- `workflow_run`",
    "",
    "## Notes",
    "",
    "- Runs are persisted in `.pi/workflows/runs/`.",
    "- Restored runs with status `running` are converted to `paused` on session start.",
    "- Deterministic executors include: start, end, prompt, if-else, switch, ask-user, sub-workflow (same-context + agent mode), and agent (subprocess mode).",
    "",
  ].join("\n");
}

function buildExportReport(bundle: CompileBundle, files: GeneratedFile[]): string {
  const bySeverity = {
    error: bundle.diagnostics.filter((d) => d.severity === "error").length,
    warning: bundle.diagnostics.filter((d) => d.severity === "warning").length,
    info: bundle.diagnostics.filter((d) => d.severity === "info").length,
  };

  const lines: string[] = [
    "# EXPORT_REPORT",
    "",
    "## Profile",
    "",
    "- Profile ID: `pi-extension`",
    "- Runtime: deterministic state-machine workflow runner",
    `- Root workflow ID: \`${bundle.rootWorkflowId}\``,
    `- Generated at: ${new Date().toISOString()}`,
    "",
    "## Runtime Support",
    "",
    "### Deterministic support",
    "",
    "- `start`",
    "- `end`",
    "- `prompt`",
    "- `if-else`",
    "- `switch`",
    "- `ask-user`",
    "- `sub-workflow` (same-context)",
    "- `sub-workflow` (agent mode via delegated subprocess)",
    "- `agent` (subprocess mode)",
    "",
    "### Degraded / planned",
    "",
    "- `skill`, `document`, `mcp-tool` resource wiring → planned phase-3",
    "",
    "## Workflow Definitions",
    "",
    ...bundle.definitions.map((d) =>
      `- \`${d.workflowId}\` — ${d.name} (nodes: ${d.nodeCount}, transitions: ${d.edgeCount}, start: ${d.startNodeId ?? "none"})`
    ),
    "",
    "## Unsupported / Degraded Nodes",
    "",
  ];

  if (bundle.unsupportedNodes.length === 0) {
    lines.push("- None");
  } else {
    for (const node of bundle.unsupportedNodes) {
      lines.push(
        `- [${node.workflowId}] \`${node.nodeId}\` (${node.type}) — ${node.reason}`
      );
    }
  }

  lines.push(
    "",
    "## Diagnostics",
    "",
    `- Errors: ${bySeverity.error}`,
    `- Warnings: ${bySeverity.warning}`,
    `- Info: ${bySeverity.info}`,
    ""
  );

  if (bundle.diagnostics.length === 0) {
    lines.push("- No diagnostics");
  } else {
    for (const d of bundle.diagnostics) {
      const scope = d.nodeId ? `${d.workflowId}/${d.nodeId}` : d.workflowId;
      lines.push(`- [${d.severity.toUpperCase()}] ${d.code} @ ${scope}: ${d.message}`);
    }
  }

  lines.push("", "## Files", "", ...files.map((f) => `- \`${f.path}\``), "");

  return lines.join("\n");
}

function buildPreview(bundle: CompileBundle): string {
  const lines: string[] = [
    "# pi-extension Preview",
    "",
    `Root workflow: ${bundle.rootWorkflowId}`,
    `Compiled workflow definitions: ${bundle.definitions.length}`,
    `Diagnostics: ${bundle.diagnostics.length}`,
    "",
    "## Workflows",
    "",
    ...bundle.definitions.map((d) =>
      `- ${d.workflowId} (${d.nodeCount} nodes, ${d.edgeCount} transitions)`
    ),
    "",
    "## Diagnostics",
    "",
  ];

  if (bundle.diagnostics.length === 0) {
    lines.push("No diagnostics");
  } else {
    for (const d of bundle.diagnostics.slice(0, 20)) {
      lines.push(`- [${d.severity}] ${d.code}: ${d.message}`);
    }
    if (bundle.diagnostics.length > 20) {
      lines.push(`- ... ${bundle.diagnostics.length - 20} more`);
    }
  }

  lines.push(
    "",
    "## Generated Runtime",
    "",
    "- .pi/extensions/nexus-workflow/index.ts",
    "- .pi/extensions/nexus-workflow/runtime/engine.ts",
    "- .pi/extensions/nexus-workflow/runtime/scheduler.ts",
    "- .pi/extensions/nexus-workflow/runtime/executors/*",
    "- .pi/extensions/nexus-workflow/runtime/ui/*",
    "",
    "Use Generate to download the full package (includes INSTALL.md and EXPORT_REPORT.md)."
  );

  return lines.join("\n") + "\n";
}

function getFatalDiagnostics(bundle: CompileBundle): ExportDiagnostic[] {
  return bundle.diagnostics.filter((d) => d.severity === "error");
}

function assertPiExtensionBundleExportable(bundle: CompileBundle): void {
  const fatal = getFatalDiagnostics(bundle);
  if (fatal.length === 0) return;

  const summary = fatal
    .slice(0, 5)
    .map((d) => `${d.workflowId}${d.nodeId ? `/${d.nodeId}` : ""}: ${d.message}`)
    .join("; ");
  const more = fatal.length > 5 ? ` (+${fatal.length - 5} more)` : "";
  throw new PiExtensionExportError(
    `pi-extension export blocked by ${fatal.length} error(s): ${summary}${more}`,
    fatal
  );
}

function getRuntimeFiles(rootWorkflowId: string): GeneratedFile[] {
  return [
    {
      path: ".pi/extensions/nexus-workflow/package.json",
      content: [
        "{",
        '  "name": "nexus-workflow-runner-extension",',
        '  "private": true,',
        '  "type": "module",',
        '  "dependencies": {',
        '    "@sinclair/typebox": "^0.34.41"',
        "  }",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: ".pi/extensions/nexus-workflow/index.ts",
      content: [
        'import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";',
        'import { Type } from "@sinclair/typebox";',
        'import { WorkflowRegistry } from "./runtime/engine";',
        'import { WorkflowScheduler } from "./runtime/scheduler";',
        "",
        `const DEFAULT_WORKFLOW_ID = ${JSON.stringify(rootWorkflowId)};`,
        "",
        "function parseRunVariables(raw: string | undefined): Record<string, unknown> {",
        "  const variables: Record<string, unknown> = {};",
        "  if (!raw || !raw.trim()) return variables;",
        "",
        "  const chunks = raw",
        "    .split(',')",
        "    .map((s) => s.trim())",
        "    .filter(Boolean);",
        "",
        "  const positional: string[] = [];",
        "  for (const chunk of chunks) {",
        "    const eq = chunk.indexOf('=');",
        "    if (eq > 0) {",
        "      const key = chunk.slice(0, eq).trim();",
        "      const value = chunk.slice(eq + 1).trim();",
        "      if (key) variables[key] = value;",
        "    } else {",
        "      positional.push(chunk);",
        "    }",
        "  }",
        "",
        "  positional.forEach((value, index) => {",
        "    variables[`$${index + 1}`] = value;",
        "  });",
        "  variables.$ARGS = positional;",
        "",
        "  return variables;",
        "}",
        "",
        "function splitRunCommand(rawArgs: string | undefined): { workflowRef: string; varsRaw: string } {",
        "  const trimmed = (rawArgs ?? '').trim();",
        "  if (!trimmed) {",
        "    return { workflowRef: DEFAULT_WORKFLOW_ID, varsRaw: '' };",
        "  }",
        "",
        "  const firstSpace = trimmed.indexOf(' ');",
        "  if (firstSpace === -1) {",
        "    if (trimmed.includes('=') || trimmed.includes(',')) {",
        "      return { workflowRef: DEFAULT_WORKFLOW_ID, varsRaw: trimmed };",
        "    }",
        "    return { workflowRef: trimmed, varsRaw: '' };",
        "  }",
        "",
        "  return {",
        "    workflowRef: trimmed.slice(0, firstSpace).trim() || DEFAULT_WORKFLOW_ID,",
        "    varsRaw: trimmed.slice(firstSpace + 1).trim(),",
        "  };",
        "}",
        "",
        "export default function (pi: ExtensionAPI) {",
        "  const registry = new WorkflowRegistry();",
        "  const scheduler = new WorkflowScheduler(pi, registry, DEFAULT_WORKFLOW_ID);",
        "",
        "  pi.on('session_start', async (_event, ctx) => {",
        "    await scheduler.initialize(ctx);",
        "    ctx.ui.notify('nexus-workflow runner loaded', 'info');",
        "  });",
        "",
        "  pi.registerCommand('wf-list', {",
        "    description: 'List exported workflows',",
        "    handler: async (_args, ctx) => {",
        "      const workflows = scheduler.listWorkflows();",
        "      if (workflows.length === 0) {",
        "        ctx.ui.notify('No workflow definitions were found in .pi/workflows', 'warning');",
        "        return;",
        "      }",
        "      const lines = workflows.map((w) => `- ${w.workflowId} — ${w.name}`);",
        "      ctx.ui.notify(lines.join('\\n'), 'info');",
        "    },",
        "  });",
        "",
        "  pi.registerCommand('wf-run', {",
        "    description: 'Run a workflow: /wf-run <name> [k=v,a,b]',",
        "    handler: async (args, ctx) => {",
        "      const parsed = splitRunCommand(args);",
        "      const run = await scheduler.startRun(parsed.workflowRef, parseRunVariables(parsed.varsRaw), ctx);",
        "      if (!run) {",
        "        ctx.ui.notify(`Workflow '${parsed.workflowRef}' not found`, 'error');",
        "        return;",
        "      }",
        "      ctx.ui.notify(`Run ${run.runId} started for ${run.workflowId}`, 'info');",
        "    },",
        "  });",
        "",
        "  pi.registerCommand('wf-status', {",
        "    description: 'Show workflow run status: /wf-status [runId]',",
        "    handler: async (args, ctx) => {",
        "      const runId = (args ?? '').trim();",
        "      if (!runId) {",
        "        const runs = scheduler.listRuns();",
        "        if (runs.length === 0) {",
        "          ctx.ui.notify('No workflow runs yet', 'info');",
        "          return;",
        "        }",
        "        const lines = runs.map((run) =>",
        "          `- ${run.runId} [${run.status}] ${run.workflowId} @ ${run.currentNodeId ?? 'done'}`",
        "        );",
        "        ctx.ui.notify(lines.join('\\n'), 'info');",
        "        return;",
        "      }",
        "",
        "      const run = scheduler.getRun(runId);",
        "      if (!run) {",
        "        ctx.ui.notify(`Run ${runId} not found`, 'error');",
        "        return;",
        "      }",
        "",
        "      const traceTail = run.trace.slice(-15);",
        "      const lines = [",
        "        `Run: ${run.runId}`,",
        "        `Workflow: ${run.workflowId}`,",
        "        `Status: ${run.status}`,",
        "        `Current node: ${run.currentNodeId ?? 'none'}`,",
        "        '',",
        "        'Trace (latest 15):',",
        "        ...traceTail.map((t) => `- ${new Date(t.timestamp).toISOString()} ${t.event}${t.nodeId ? ` @ ${t.nodeId}` : ''}${t.message ? ` — ${t.message}` : ''}`),",
        "      ];",
        "      ctx.ui.notify(lines.join('\\n'), 'info');",
        "    },",
        "  });",
        "",
        "  pi.registerCommand('wf-continue', {",
        "    description: 'Continue a waiting or paused run: /wf-continue [runId] [answer]',",
        "    handler: async (args, ctx) => {",
        "      const raw = (args ?? '').trim();",
        "      const waitingOrPaused = scheduler",
        "        .listRuns()",
        "        .filter((run) => run.status === 'waiting_user' || run.status === 'paused');",
        "",
        "      let runId = '';",
        "      let answer = '';",
        "",
        "      if (!raw) {",
        "        if (waitingOrPaused.length !== 1) {",
        "          ctx.ui.notify(",
        "            waitingOrPaused.length === 0",
        "              ? 'No waiting/paused runs found. Use /wf-status to inspect runs.'",
        "              : 'Multiple waiting/paused runs found. Use /wf-continue <runId> [answer].',",
        "            'warning'",
        "          );",
        "          return;",
        "        }",
        "        runId = waitingOrPaused[0]!.runId;",
        "      } else {",
        "        const split = raw.indexOf(' ');",
        "        runId = split === -1 ? raw : raw.slice(0, split).trim();",
        "        answer = split === -1 ? '' : raw.slice(split + 1).trim();",
        "",
        "        if (runId === 'latest' || runId === '@waiting') {",
        "          if (waitingOrPaused.length === 0) {",
        "            ctx.ui.notify('No waiting/paused runs found', 'warning');",
        "            return;",
        "          }",
        "          runId = waitingOrPaused[0]!.runId;",
        "        }",
        "      }",
        "",
        "      const resumed = await scheduler.continueRun(runId, answer || undefined, ctx);",
        "      if (!resumed) {",
        "        ctx.ui.notify(`Run ${runId} is not resumable`, 'warning');",
        "        return;",
        "      }",
        "      ctx.ui.notify(`Run ${runId} resumed`, 'info');",
        "    },",
        "  });",
        "",
        "  pi.on('input', async (event, ctx) => {",
        "    if (event.source !== 'interactive') return { action: 'continue' as const };",
        "",
        "    const text = (event.text ?? '').trim();",
        "    if (!text || text.startsWith('/')) return { action: 'continue' as const };",
        "",
        "    const waitingRuns = scheduler.listRuns().filter((run) => run.status === 'waiting_user');",
        "    if (waitingRuns.length !== 1) return { action: 'continue' as const };",
        "",
        "    const target = waitingRuns[0]!;",
        "    const resumed = await scheduler.continueRun(target.runId, text, ctx);",
        "    if (!resumed) return { action: 'continue' as const };",
        "",
        "    ctx.ui.notify(`Applied feedback to ${target.runId}`, 'info');",
        "    return { action: 'handled' as const };",
        "  });",
        "",
        "  pi.registerCommand('wf-cancel', {",
        "    description: 'Cancel an active workflow run: /wf-cancel <runId>',",
        "    handler: async (args, ctx) => {",
        "      const runId = (args ?? '').trim();",
        "      if (!runId) {",
        "        ctx.ui.notify('Usage: /wf-cancel <runId>', 'error');",
        "        return;",
        "      }",
        "      const cancelled = scheduler.cancelRun(runId, ctx);",
        "      if (!cancelled) {",
        "        ctx.ui.notify(`Run ${runId} not found or already terminal`, 'warning');",
        "        return;",
        "      }",
        "      ctx.ui.notify(`Run ${runId} cancelled`, 'info');",
        "    },",
        "  });",
        "",
        "  pi.registerCommand('wf-clear', {",
        "    description: 'Clear finished/cancelled/error runs',",
        "    handler: async (_args, ctx) => {",
        "      const count = scheduler.clearRuns(ctx, false);",
        "      ctx.ui.notify(`Cleared ${count} run(s)`, 'info');",
        "    },",
        "  });",
        "",
        "  pi.registerTool({",
        "    name: 'workflow_run',",
        "    label: 'Workflow Run',",
        "    description: 'Start a deterministic workflow run by workflow id/name',",
        "    parameters: Type.Object({",
        "      workflow: Type.Optional(Type.String({ description: 'Workflow id or name (optional)' })),",
        "      args: Type.Optional(Type.String({ description: 'Variables as comma-separated values (k=v,a,b)' })),",
        "    }),",
        "    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {",
        "      const workflowRef = params.workflow?.trim() || DEFAULT_WORKFLOW_ID;",
        "      const run = await scheduler.startRun(workflowRef, parseRunVariables(params.args), ctx);",
        "      if (!run) {",
        "        return {",
        "          content: [{ type: 'text', text: `Workflow ${workflowRef} not found` }],",
        "          details: { workflowRef, status: 'error' },",
        "          isError: true,",
        "        };",
        "      }",
        "",
        "      return {",
        "        content: [{ type: 'text', text: `Run ${run.runId} started (${run.workflowId}) status=${run.status}` }],",
        "        details: { runId: run.runId, workflowId: run.workflowId, status: run.status },",
        "      };",
        "    },",
        "  });",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: ".pi/extensions/nexus-workflow/runtime/types.ts",
      content: [
        "export type RunStatus =",
        "  | 'pending'",
        "  | 'running'",
        "  | 'waiting_user'",
        "  | 'paused'",
        "  | 'done'",
        "  | 'error'",
        "  | 'cancelled';",
        "",
        "export interface TraceEntry {",
        "  timestamp: number;",
        "  event: string;",
        "  nodeId?: string;",
        "  message?: string;",
        "  details?: Record<string, unknown>;",
        "}",
        "",
        "export interface RunStackFrame {",
        "  workflowId: string;",
        "  returnNodeId: string | null;",
        "  fromNodeId: string;",
        "}",
        "",
        "export interface AskUserWaitSpec {",
        "  kind: 'ask-user';",
        "  nodeId: string;",
        "  questionText: string;",
        "  multipleSelection: boolean;",
        "  aiSuggestOptions: boolean;",
        "  options: Array<{ label: string; description?: string }>;",
        "}",
        "",
        "export type WaitSpec = AskUserWaitSpec;",
        "",
        "export interface WorkflowRuntimeError {",
        "  code:",
        "    | 'WF_NODE_EXECUTOR_MISSING'",
        "    | 'WF_TRANSITION_INVALID'",
        "    | 'WF_EXPRESSION_ERROR'",
        "    | 'WF_SUBPROCESS_FAILED'",
        "    | 'WF_USER_INPUT_TIMEOUT'",
        "    | 'WF_CANCELLED'",
        "    | 'WF_MAX_STEPS_EXCEEDED'",
        "    | 'WF_WORKFLOW_MISSING'",
        "    | 'WF_NODE_MISSING'",
        "    | 'WF_START_MISSING';",
        "  message: string;",
        "  nodeId?: string;",
        "  details?: Record<string, unknown>;",
        "}",
        "",
        "export interface RunState {",
        "  runId: string;",
        "  workflowId: string;",
        "  status: RunStatus;",
        "  currentNodeId: string | null;",
        "  variables: Record<string, unknown>;",
        "  outputs: Record<string, unknown>;",
        "  stack: RunStackFrame[];",
        "  waitingFor?: WaitSpec;",
        "  trace: TraceEntry[];",
        "  startedAt: number;",
        "  updatedAt: number;",
        "  stepCount: number;",
        "  lastError?: WorkflowRuntimeError;",
        "}",
        "",
        "export interface RuntimeWorkflowNode {",
        "  id: string;",
        "  type: string;",
        "  label: string;",
        "  config: Record<string, unknown>;",
        "}",
        "",
        "export interface RuntimeTransition {",
        "  sourceNodeId: string;",
        "  sourceHandle: string;",
        "  targetNodeId: string;",
        "}",
        "",
        "export interface RuntimeWorkflowDefinition {",
        "  version: 1;",
        "  workflowId: string;",
        "  name: string;",
        "  parentWorkflowId: string | null;",
        "  viaNodeId: string | null;",
        "  startNodeId: string | null;",
        "  nodeCount: number;",
        "  edgeCount: number;",
        "  nodes: RuntimeWorkflowNode[];",
        "  transitions: RuntimeTransition[];",
        "}",
        "",
        "export type ExecutionResult =",
        "  | { type: 'advance'; handle?: string; output?: unknown; message?: string }",
        "  | { type: 'wait'; wait: WaitSpec; output?: unknown; message?: string }",
        "  | { type: 'enter_sub_workflow'; workflowId: string; returnHandle?: string; output?: unknown; message?: string }",
        "  | { type: 'complete'; output?: unknown; message?: string }",
        "  | { type: 'fail'; error: WorkflowRuntimeError };",
        "",
      ].join("\n"),
    },
    {
      path: ".pi/extensions/nexus-workflow/runtime/engine.ts",
      content: [
        'import fs from "node:fs";',
        'import path from "node:path";',
        'import type { RuntimeWorkflowDefinition, RuntimeWorkflowNode } from "./types";',
        "",
        "const WORKFLOWS_DIR = path.join('.pi', 'workflows');",
        "",
        "function isWorkflowDefinitionFile(fileName: string): boolean {",
        "  if (!fileName.endsWith('.json')) return false;",
        "  if (fileName.endsWith('.meta.json')) return false;",
        "  if (fileName === 'workflow-runner.config.json') return false;",
        "  return true;",
        "}",
        "",
        "export class WorkflowRegistry {",
        "  private workflowsById = new Map<string, RuntimeWorkflowDefinition>();",
        "",
        "  loadFromDisk(cwd: string): void {",
        "    this.workflowsById.clear();",
        "    const dir = path.join(cwd, WORKFLOWS_DIR);",
        "    if (!fs.existsSync(dir)) return;",
        "",
        "    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {",
        "      if (!entry.isFile()) continue;",
        "      if (!isWorkflowDefinitionFile(entry.name)) continue;",
        "",
        "      const fullPath = path.join(dir, entry.name);",
        "      try {",
        "        const raw = fs.readFileSync(fullPath, 'utf8');",
        "        const parsed = JSON.parse(raw) as RuntimeWorkflowDefinition;",
        "        if (!parsed?.workflowId || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.transitions)) {",
        "          continue;",
        "        }",
        "        this.workflowsById.set(parsed.workflowId, parsed);",
        "      } catch {",
        "        // ignore malformed files",
        "      }",
        "    }",
        "  }",
        "",
        "  list(): RuntimeWorkflowDefinition[] {",
        "    return [...this.workflowsById.values()].sort((a, b) => a.name.localeCompare(b.name));",
        "  }",
        "",
        "  getById(workflowId: string): RuntimeWorkflowDefinition | undefined {",
        "    return this.workflowsById.get(workflowId);",
        "  }",
        "",
        "  getByReference(reference: string): RuntimeWorkflowDefinition | undefined {",
        "    const byId = this.workflowsById.get(reference);",
        "    if (byId) return byId;",
        "",
        "    const lowered = reference.trim().toLowerCase();",
        "    for (const wf of this.workflowsById.values()) {",
        "      if (wf.name.trim().toLowerCase() === lowered) return wf;",
        "      if (wf.workflowId.trim().toLowerCase() === lowered) return wf;",
        "    }",
        "    return undefined;",
        "  }",
        "",
        "  getNode(workflowId: string, nodeId: string): RuntimeWorkflowNode | undefined {",
        "    return this.workflowsById.get(workflowId)?.nodes.find((n) => n.id === nodeId);",
        "  }",
        "}",
        "",
        "export function hasOutgoingTransition(",
        "  workflow: RuntimeWorkflowDefinition,",
        "  sourceNodeId: string",
        "): boolean {",
        "  return workflow.transitions.some((t) => t.sourceNodeId === sourceNodeId);",
        "}",
        "",
        "export function resolveNextNode(",
        "  workflow: RuntimeWorkflowDefinition,",
        "  sourceNodeId: string,",
        "  preferredHandles: string[] = ['output']",
        "): string | null {",
        "  const outgoing = workflow.transitions.filter((t) => t.sourceNodeId === sourceNodeId);",
        "  if (outgoing.length === 0) return null;",
        "",
        "  for (const handle of preferredHandles) {",
        "    const match = outgoing.find((t) => t.sourceHandle === handle);",
        "    if (match) return match.targetNodeId;",
        "  }",
        "",
        "  return null;",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: ".pi/extensions/nexus-workflow/runtime/executors/prompt.ts",
      content: [
        'import type { ExecutionResult, RunState, RuntimeWorkflowNode } from "../types";',
        "",
        "function lookupValue(path: string, run: RunState): unknown {",
        "  if (path in run.variables) return run.variables[path];",
        "  if (path in run.outputs) return run.outputs[path];",
        "",
        "  const dot = path.split('.');",
        "  let cursor: any = { variables: run.variables, outputs: run.outputs };",
        "  for (const key of dot) {",
        "    if (cursor && typeof cursor === 'object' && key in cursor) {",
        "      cursor = cursor[key];",
        "    } else {",
        "      return undefined;",
        "    }",
        "  }",
        "  return cursor;",
        "}",
        "",
        "export function renderPromptTemplate(template: string, run: RunState): string {",
        "  return template.replace(/\{\{\s*([\w.$-]+)\s*\}\}/g, (_m, key) => {",
        "    const value = lookupValue(String(key), run);",
        "    return value === undefined || value === null ? '' : String(value);",
        "  });",
        "}",
        "",
        "export function executePromptNode(node: RuntimeWorkflowNode, run: RunState): ExecutionResult {",
        "  const rawPrompt = String(node.config.promptText ?? '');",
        "  const renderedPrompt = renderPromptTemplate(rawPrompt, run);",
        "",
        "  return {",
        "    type: 'advance',",
        "    handle: 'output',",
        "    output: {",
        "      promptText: rawPrompt,",
        "      renderedPrompt,",
        "    },",
        "    message: renderedPrompt ? 'Prompt rendered' : 'Prompt node has empty text',",
        "  };",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: ".pi/extensions/nexus-workflow/runtime/executors/if-else.ts",
      content: [
        'import type { ExecutionResult, RunState, RuntimeWorkflowNode } from "../types";',
        "",
        "function evaluateExpression(expression: string, scope: Record<string, unknown>): boolean {",
        "  if (!expression.trim()) return false;",
        "  const fn = new Function('scope', `with (scope) { return Boolean(${expression}); }`);",
        "  return Boolean(fn(scope));",
        "}",
        "",
        "export function executeIfElseNode(node: RuntimeWorkflowNode, run: RunState): ExecutionResult {",
        "  const branches = Array.isArray(node.config.branches) ? node.config.branches as Array<{ label?: string; condition?: string }> : [];",
        "  const evaluationTarget = String(node.config.evaluationTarget ?? '').trim();",
        "",
        "  const scope: Record<string, unknown> = {",
        "    ...run.variables,",
        "    outputs: run.outputs,",
        "    variables: run.variables,",
        "  };",
        "  if (evaluationTarget) scope.$target = run.variables[evaluationTarget] ?? run.outputs[evaluationTarget];",
        "",
        "  try {",
        "    const first = branches[0];",
        "    const second = branches[1];",
        "",
        "    const firstMatch = first?.condition",
        "      ? evaluateExpression(String(first.condition), scope)",
        "      : Boolean(scope.$target);",
        "",
        "    if (firstMatch) {",
        "      return {",
        "        type: 'advance',",
        "        handle: 'true',",
        "        output: { matched: first?.label ?? 'true' },",
        "        message: `If/Else matched '${first?.label ?? 'true'}'`,",
        "      };",
        "    }",
        "",
        "    if (second?.condition) {",
        "      const secondMatch = evaluateExpression(String(second.condition), scope);",
        "      if (secondMatch) {",
        "        return {",
        "          type: 'advance',",
        "          handle: 'false',",
        "          output: { matched: second.label ?? 'false' },",
        "          message: `If/Else matched '${second.label ?? 'false'}'`,",
        "        };",
        "      }",
        "    }",
        "",
        "    return {",
        "      type: 'advance',",
        "      handle: 'false',",
        "      output: { matched: second?.label ?? 'false' },",
        "      message: `If/Else fell back to '${second?.label ?? 'false'}'`,",
        "    };",
        "  } catch (error) {",
        "    return {",
        "      type: 'fail',",
        "      error: {",
        "        code: 'WF_EXPRESSION_ERROR',",
        "        nodeId: node.id,",
        "        message: error instanceof Error ? error.message : String(error),",
        "      },",
        "    };",
        "  }",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: ".pi/extensions/nexus-workflow/runtime/executors/switch.ts",
      content: [
        'import type { ExecutionResult, RunState, RuntimeWorkflowNode } from "../types";',
        "",
        "function evaluateExpression(expression: string, scope: Record<string, unknown>): boolean {",
        "  if (!expression.trim()) return false;",
        "  const fn = new Function('scope', `with (scope) { return Boolean(${expression}); }`);",
        "  return Boolean(fn(scope));",
        "}",
        "",
        "export function executeSwitchNode(node: RuntimeWorkflowNode, run: RunState): ExecutionResult {",
        "  const branches = Array.isArray(node.config.branches)",
        "    ? (node.config.branches as Array<{ label?: string; condition?: string }>)",
        "    : [];",
        "  const evaluationTarget = String(node.config.evaluationTarget ?? '').trim();",
        "",
        "  const scope: Record<string, unknown> = {",
        "    ...run.variables,",
        "    outputs: run.outputs,",
        "    variables: run.variables,",
        "  };",
        "  if (evaluationTarget) scope.$target = run.variables[evaluationTarget] ?? run.outputs[evaluationTarget];",
        "",
        "  try {",
        "    let defaultBranch: { label?: string; condition?: string } | undefined;",
        "",
        "    for (const branch of branches) {",
        "      const label = (branch.label || '').trim() || 'default';",
        "      if (label === 'default') {",
        "        defaultBranch = branch;",
        "        continue;",
        "      }",
        "",
        "      if (branch.condition && evaluateExpression(String(branch.condition), scope)) {",
        "        return {",
        "          type: 'advance',",
        "          handle: label,",
        "          output: { matched: label },",
        "          message: `Switch matched '${label}'`,",
        "        };",
        "      }",
        "    }",
        "",
        "    if (defaultBranch) {",
        "      return {",
        "        type: 'advance',",
        "        handle: 'default',",
        "        output: { matched: 'default' },",
        "        message: " + "`Switch fell back to 'default'`" + ",",
        "      };",
        "    }",
        "",
        "    return {",
        "      type: 'advance',",
        "      handle: 'output',",
        "      output: { matched: null },",
        "      message: 'Switch had no matching branch',",
        "    };",
        "  } catch (error) {",
        "    return {",
        "      type: 'fail',",
        "      error: {",
        "        code: 'WF_EXPRESSION_ERROR',",
        "        nodeId: node.id,",
        "        message: error instanceof Error ? error.message : String(error),",
        "      },",
        "    };",
        "  }",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: ".pi/extensions/nexus-workflow/runtime/executors/ask-user.ts",
      content: [
        'import type { AskUserWaitSpec, ExecutionResult, RuntimeWorkflowNode } from "../types";',
        "",
        "export function executeAskUserNode(node: RuntimeWorkflowNode): ExecutionResult {",
        "  const wait: AskUserWaitSpec = {",
        "    kind: 'ask-user',",
        "    nodeId: node.id,",
        "    questionText: String(node.config.questionText ?? 'Please provide input'),",
        "    multipleSelection: Boolean(node.config.multipleSelection),",
        "    aiSuggestOptions: Boolean(node.config.aiSuggestOptions),",
        "    options: Array.isArray(node.config.options)",
        "      ? (node.config.options as Array<{ label: string; description?: string }>)",
        "      : [],",
        "  };",
        "",
        "  return {",
        "    type: 'wait',",
        "    wait,",
        "    message: 'Waiting for user input',",
        "  };",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: ".pi/extensions/nexus-workflow/runtime/executors/sub-workflow.ts",
      content: [
        'import { executeAgentNode, type AgentExecutorContext } from "./agent";',
        'import type { ExecutionResult, RunState, RuntimeWorkflowNode } from "../types";',
        "",
        "function serializeParentVariables(run: RunState): string {",
        "  const pairs: string[] = [];",
        "  for (const [key, value] of Object.entries(run.variables)) {",
        "    if (!key || key.startsWith('__')) continue;",
        "    if (value === undefined || value === null) continue;",
        "",
        "    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {",
        "      const safe = String(value).replace(/,/g, ' ');",
        "      pairs.push(`${key}=${safe}`);",
        "      continue;",
        "    }",
        "",
        "    if (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {",
        "      const safe = value.map((v) => String(v).replace(/,/g, ' ')).join('|');",
        "      pairs.push(`${key}=${safe}`);",
        "    }",
        "  }",
        "  return pairs.join(',');",
        "}",
        "",
        "export async function executeSubWorkflowNode(",
        "  node: RuntimeWorkflowNode,",
        "  run: RunState,",
        "  ctx: AgentExecutorContext",
        "): Promise<ExecutionResult> {",
        "  const mode = String(node.config.mode ?? 'same-context');",
        "  const workflowId = String(node.config.workflowId ?? '').trim();",
        "  if (!workflowId) {",
        "    return {",
        "      type: 'fail',",
        "      error: {",
        "        code: 'WF_TRANSITION_INVALID',",
        "        nodeId: node.id,",
        "        message: 'Sub-workflow node has no workflowId',",
        "      },",
        "    };",
        "  }",
        "",
        "  if (mode === 'same-context') {",
        "    return {",
        "      type: 'enter_sub_workflow',",
        "      workflowId,",
        "      returnHandle: 'output',",
        "      message: `Entering sub-workflow ${workflowId}`",
        "    };",
        "  }",
        "",
        "  if (mode === 'agent') {",
        "    const vars = serializeParentVariables(run);",
        "    const command = vars ? `/wf-run ${workflowId} ${vars}` : `/wf-run ${workflowId}`;",
        "",
        "    const delegatedNode: RuntimeWorkflowNode = {",
        "      ...node,",
        "      type: 'agent',",
        "      label: `${node.label} (agent sub-workflow)`,",
        "      config: {",
        "        ...node.config,",
        "        promptText: command,",
        "        parameterMappings: [],",
        "        variableMappings: {},",
        "        useExtensions: true,",
        "      },",
        "    };",
        "",
        "    const result = await executeAgentNode(delegatedNode, run, ctx);",
        "    if (result.type === 'advance') {",
        "      return {",
        "        ...result,",
        "        handle: 'output',",
        "        message: result.message ?? `Delegated sub-workflow ${workflowId} through subprocess`,",
        "      };",
        "    }",
        "    return result;",
        "  }",
        "",
        "  return {",
        "    type: 'fail',",
        "    error: {",
        "      code: 'WF_NODE_EXECUTOR_MISSING',",
        "      nodeId: node.id,",
        "      message: `Unsupported sub-workflow mode '${mode}'`,",
        "    },",
        "  };",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: ".pi/extensions/nexus-workflow/runtime/executors/agent.ts",
      content: [
        'import { spawn, type ChildProcess } from "node:child_process";',
        'import fs from "node:fs";',
        'import path from "node:path";',
        'import type { ExecutionResult, RunState, RuntimeWorkflowNode } from "../types";',
        "",
        "const DEFAULT_TOOLS = ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls'];",
        "",
        "export interface AgentExecutorContext {",
        "  cwd: string;",
        "  activeModel?: { provider: string; id: string } | null;",
        "  onProcessStart?: (proc: ChildProcess) => void;",
        "  onProcessEnd?: () => void;",
        "  isCancelled?: () => boolean;",
        "}",
        "",
        "function ensureSessionDir(cwd: string): string {",
        "  const dir = path.join(cwd, '.pi', 'agent-sessions', 'workflows');",
        "  fs.mkdirSync(dir, { recursive: true });",
        "  return dir;",
        "}",
        "",
        "function lookup(pathExpr: string, run: RunState): unknown {",
        "  if (pathExpr in run.variables) return run.variables[pathExpr];",
        "  if (pathExpr in run.outputs) return run.outputs[pathExpr];",
        "",
        "  const dot = pathExpr.split('.');",
        "  let cursor: unknown = { variables: run.variables, outputs: run.outputs };",
        "  for (const part of dot) {",
        "    if (cursor && typeof cursor === 'object' && part in (cursor as Record<string, unknown>)) {",
        "      cursor = (cursor as Record<string, unknown>)[part];",
        "    } else {",
        "      return undefined;",
        "    }",
        "  }",
        "  return cursor;",
        "}",
        "",
        "function buildContextForAgent(node: RuntimeWorkflowNode, run: RunState): string {",
        "  const outputs: Record<string, unknown> = {};",
        "  for (const [nodeId, value] of Object.entries(run.outputs)) {",
        "    if (nodeId === node.id) continue;",
        "",
        "    if (value && typeof value === 'object') {",
        "      const rec = value as Record<string, unknown>;",
        "      const resultText = typeof rec.resultText === 'string' ? rec.resultText : undefined;",
        "      if (resultText !== undefined) {",
        "        outputs[nodeId] = {",
        "          ...rec,",
        "          resultText: resultText.length > 1200 ? `${resultText.slice(0, 1200)}...` : resultText,",
        "        };",
        "        continue;",
        "      }",
        "    }",
        "",
        "    outputs[nodeId] = value;",
        "  }",
        "",
        "  const context = {",
        "    workflowRunId: run.runId,",
        "    variables: run.variables,",
        "    previousOutputs: outputs,",
        "  };",
        "",
        "  const serialized = JSON.stringify(context, null, 2);",
        "  return serialized.length > 6000 ? `${serialized.slice(0, 6000)}...` : serialized;",
        "}",
        "",
        "function renderTemplate(template: string, run: RunState, extra: Record<string, unknown> = {}): string {",
        "  return template.replace(/\\{\\{\\s*([\\w.$-]+)\\s*\\}\\}/g, (_m, key) => {",
        "    if (key in extra) {",
        "      const value = extra[key];",
        "      return value === undefined || value === null ? '' : String(value);",
        "    }",
        "    const value = lookup(String(key), run);",
        "    return value === undefined || value === null ? '' : String(value);",
        "  });",
        "}",
        "",
        "function resolveMappedArg(mapping: string, run: RunState): string {",
        "  const trimmed = mapping.trim();",
        "  if (!trimmed) return '';",
        "",
        "  const byLookup = lookup(trimmed, run);",
        "  if (byLookup !== undefined && byLookup !== null) return String(byLookup);",
        "",
        "  const dollarMatch = trimmed.match(/^\\$(\\d+)$/);",
        "  if (dollarMatch) {",
        "    const positional = run.variables[`$${dollarMatch[1]}`];",
        "    if (positional !== undefined && positional !== null) return String(positional);",
        "  }",
        "",
        "  return renderTemplate(trimmed, run);",
        "}",
        "",
        "function applyPositional(prompt: string, mappings: string[], run: RunState): string {",
        "  if (!mappings.length) return prompt;",
        "",
        "  const resolved = mappings.map((m) => resolveMappedArg(m, run));",
        "  return prompt.replace(/\\$(\\d+)/g, (_m, idx) => {",
        "    const i = Number(idx) - 1;",
        "    return resolved[i] ?? '';",
        "  });",
        "}",
        "",
        "function enabledToolsCsv(disabledTools: string[]): string {",
        "  const disabled = new Set(disabledTools.map((t) => t.trim()).filter(Boolean));",
        "  return DEFAULT_TOOLS.filter((t) => !disabled.has(t)).join(',');",
        "}",
        "",
        "export async function executeAgentNode(",
        "  node: RuntimeWorkflowNode,",
        "  run: RunState,",
        "  ctx: AgentExecutorContext",
        "): Promise<ExecutionResult> {",
        "  if (ctx.isCancelled?.()) {",
        "    return {",
        "      type: 'fail',",
        "      error: {",
        "        code: 'WF_CANCELLED',",
        "        nodeId: node.id,",
        "        message: 'Run cancelled before agent node execution',",
        "      },",
        "    };",
        "  }",
        "",
        "  const promptTemplate = String(node.config.promptText ?? '');",
        "  const parameterMappings = Array.isArray(node.config.parameterMappings)",
        "    ? (node.config.parameterMappings as string[])",
        "    : [];",
        "  const variableMappings = (node.config.variableMappings ?? {}) as Record<string, string>;",
        "",
        "  const extra: Record<string, unknown> = {};",
        "  for (const [key, value] of Object.entries(variableMappings)) {",
        "    extra[key.replace(/^\\{\\{|\\}\\}$/g, '')] = value;",
        "  }",
        "",
        "  const withVars = renderTemplate(promptTemplate, run, extra);",
        "  const finalPrompt = applyPositional(withVars, parameterMappings, run).trim();",
        "  if (!finalPrompt) {",
        "    return {",
        "      type: 'fail',",
        "      error: {",
        "        code: 'WF_SUBPROCESS_FAILED',",
        "        nodeId: node.id,",
        "        message: 'Agent node has empty prompt after variable resolution',",
        "      },",
        "    };",
        "  }",
        "",
        "  const safeNodeId = node.id.replace(/[^a-z0-9_-]/gi, '-');",
        "  const sessionDir = ensureSessionDir(ctx.cwd);",
        "  const sessionFile = path.join(sessionDir, `${run.runId}-${safeNodeId}.jsonl`);",
        "",
        "  const useExtensions = Boolean(node.config.useExtensions);",
        "",
        "  const args = [",
        "    '--mode', 'json',",
        "    '-p',",
        "    '--thinking', 'off',",
        "    '--session', sessionFile,",
        "  ];",
        "",
        "  if (!useExtensions) {",
        "    args.push('--no-extensions');",
        "  }",
        "  if (fs.existsSync(sessionFile)) {",
        "    args.push('-c');",
        "  }",
        "",
        "  const model = String(node.config.model ?? 'inherit').trim();",
        "  if (model && model !== 'inherit') {",
        "    args.push('--model', model);",
        "  } else if (ctx.activeModel) {",
        "    args.push('--model', `${ctx.activeModel.provider}/${ctx.activeModel.id}`);",
        "  }",
        "",
        "  const tools = enabledToolsCsv(Array.isArray(node.config.disabledTools) ? (node.config.disabledTools as string[]) : []);",
        "  if (tools) args.push('--tools', tools);",
        "",
        "  const promptWithContext = [",
        "    'You are executing a workflow node inside Nexus Workflow Runner.',",
        "    'Use the workflow context below as source-of-truth for prior steps and user choices.',",
        "    '',",
        "    'Workflow context (JSON):',",
        "    buildContextForAgent(node, run),",
        "    '',",
        "    'Task:',",
        "    finalPrompt,",
        "  ].join('\\n');",
        "",
        "  args.push(promptWithContext);",
        "",
        "  return await new Promise<ExecutionResult>((resolve) => {",
        "    const proc = spawn('pi', args, {",
        "      cwd: ctx.cwd,",
        "      stdio: ['ignore', 'pipe', 'pipe'],",
        "      env: { ...process.env },",
        "    });",
        "",
        "    ctx.onProcessStart?.(proc);",
        "",
        "    const startedAt = Date.now();",
        "    let stdoutBuffer = '';",
        "    let stderrText = '';",
        "    let outputText = '';",
        "    let toolCount = 0;",
        "    let abortedByCancel = false;",
        "",
        "    const cancelTimer = setInterval(() => {",
        "      if (ctx.isCancelled?.()) {",
        "        abortedByCancel = true;",
        "        try {",
        "          proc.kill('SIGTERM');",
        "        } catch {",
        "          // ignore",
        "        }",
        "      }",
        "    }, 200);",
        "",
        "    const parseLine = (line: string) => {",
        "      if (!line.trim()) return;",
        "      try {",
        "        const event = JSON.parse(line);",
        "        if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {",
        "          outputText += String(event.assistantMessageEvent.delta ?? '');",
        "          return;",
        "        }",
        "        if (event.type === 'tool_execution_start') {",
        "          toolCount += 1;",
        "        }",
        "      } catch {",
        "        // ignore malformed JSON lines",
        "      }",
        "    };",
        "",
        "    proc.stdout?.setEncoding('utf8');",
        "    proc.stdout?.on('data', (chunk: string) => {",
        "      stdoutBuffer += chunk;",
        "      const lines = stdoutBuffer.split('\\n');",
        "      stdoutBuffer = lines.pop() ?? '';",
        "      for (const line of lines) parseLine(line);",
        "    });",
        "",
        "    proc.stderr?.setEncoding('utf8');",
        "    proc.stderr?.on('data', (chunk: string) => {",
        "      stderrText += chunk;",
        "    });",
        "",
        "    proc.on('close', (code) => {",
        "      clearInterval(cancelTimer);",
        "      ctx.onProcessEnd?.();",
        "",
        "      if (stdoutBuffer.trim()) parseLine(stdoutBuffer);",
        "",
        "      const elapsedMs = Date.now() - startedAt;",
        "",
        "      if (abortedByCancel) {",
        "        resolve({",
        "          type: 'fail',",
        "          error: {",
        "            code: 'WF_CANCELLED',",
        "            nodeId: node.id,",
        "            message: 'Agent subprocess cancelled',",
        "          },",
        "        });",
        "        return;",
        "      }",
        "",
        "      if ((code ?? 1) !== 0) {",
        "        resolve({",
        "          type: 'fail',",
        "          error: {",
        "            code: 'WF_SUBPROCESS_FAILED',",
        "            nodeId: node.id,",
        "            message: stderrText.trim() || `Agent subprocess exited with code ${code ?? 1}`,",
        "            details: {",
        "              exitCode: code ?? 1,",
        "              stderr: stderrText.slice(-2000),",
        "              outputPreview: outputText.slice(-2000),",
        "            },",
        "          },",
        "        });",
        "        return;",
        "      }",
        "",
        "      const previewLine = outputText",
        "        .split('\\n')",
        "        .map((line) => line.trim())",
        "        .find((line) => line.length > 0) ?? '';",
        "",
        "      resolve({",
        "        type: 'advance',",
        "        handle: 'output',",
        "        message: `Agent node '${node.label}' completed in ${Math.round(elapsedMs / 1000)}s${previewLine ? ` — ${previewLine.slice(0, 120)}` : ''}`,",
        "        output: {",
        "          nodeId: node.id,",
        "          sessionFile,",
        "          elapsedMs,",
        "          toolCount,",
        "          resultText: outputText,",
        "          resultPreview: previewLine,",
        "        },",
        "      });",
        "    });",
        "",
        "    proc.on('error', (error) => {",
        "      clearInterval(cancelTimer);",
        "      ctx.onProcessEnd?.();",
        "      resolve({",
        "        type: 'fail',",
        "        error: {",
        "          code: 'WF_SUBPROCESS_FAILED',",
        "          nodeId: node.id,",
        "          message: error instanceof Error ? error.message : String(error),",
        "        },",
        "      });",
        "    });",
        "  });",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: ".pi/extensions/nexus-workflow/runtime/ui/render-cards.ts",
      content: [
        'import type { RunState } from "../types";',
        "",
        "function trimToWidth(value: string, width: number): string {",
        "  if (value.length <= width) return value;",
        "  return `${value.slice(0, Math.max(0, width - 3))}...`;",
        "}",
        "",
        "export function renderRunCards(runs: RunState[], width: number, theme: any): string[] {",
        "  if (runs.length === 0) {",
        "    return [theme.fg('dim', 'No workflow runs yet. Use /wf-run <name>.')];",
        "  }",
        "",
        "  const sorted = [...runs].sort((a, b) => b.updatedAt - a.updatedAt);",
        "  const lines: string[] = [];",
        "",
        "  for (const run of sorted.slice(0, 12)) {",
        "    const statusColor =",
        "      run.status === 'done'",
        "        ? 'success'",
        "        : run.status === 'error'",
        "          ? 'error'",
        "          : run.status === 'waiting_user'",
        "            ? 'warning'",
        "            : run.status === 'cancelled'",
        "              ? 'muted'",
        "              : 'accent';",
        "",
        "    const elapsedSec = Math.max(0, Math.round((Date.now() - run.startedAt) / 1000));",
        "    const left = `${run.runId} [${run.status}] ${run.workflowId}`;",
        "    const right = `${elapsedSec}s @ ${run.currentNodeId ?? 'done'}`;",
        "",
        "    let line = theme.fg(statusColor, left);",
        "    const pad = Math.max(1, width - left.length - right.length);",
        "    line += ' '.repeat(pad) + theme.fg('dim', right);",
        "",
        "    lines.push(trimToWidth(line, width));",
        "",
        "    const lastTrace = run.trace[run.trace.length - 1];",
        "    if (lastTrace?.message) {",
        "      lines.push(theme.fg('dim', trimToWidth(`  ↳ ${lastTrace.message}`, width)));",
        "    }",
        "  }",
        "",
        "  return lines;",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: ".pi/extensions/nexus-workflow/runtime/ui/widget.ts",
      content: [
        'import { Text } from "@mariozechner/pi-tui";',
        'import type { RunState } from "../types";',
        'import { renderRunCards } from "./render-cards";',
        "",
        "export function renderWorkflowWidget(ctx: any, runs: RunState[]): void {",
        "  ctx.ui.setWidget('workflow-runner', (_tui: any, theme: any) => {",
        "    const text = new Text('', 0, 1);",
        "",
        "    return {",
        "      render(width: number): string[] {",
        "        const lines = [",
        "          theme.fg('accent', theme.bold('Workflow Runner')),",
        "          ...renderRunCards(runs, width, theme),",
        "        ];",
        "        text.setText(lines.join('\\n'));",
        "        return text.render(width);",
        "      },",
        "      invalidate() {",
        "        text.invalidate();",
        "      },",
        "    };",
        "  });",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: ".pi/extensions/nexus-workflow/runtime/scheduler.ts",
      content: [
        'import fs from "node:fs";',
        'import path from "node:path";',
        'import type { ChildProcess } from "node:child_process";',
        'import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";',
        'import { WorkflowRegistry, hasOutgoingTransition, resolveNextNode } from "./engine";',
        'import { renderWorkflowWidget } from "./ui/widget";',
        'import { executePromptNode } from "./executors/prompt";',
        'import { executeIfElseNode } from "./executors/if-else";',
        'import { executeSwitchNode } from "./executors/switch";',
        'import { executeAskUserNode } from "./executors/ask-user";',
        'import { executeSubWorkflowNode } from "./executors/sub-workflow";',
        'import { executeAgentNode, type AgentExecutorContext } from "./executors/agent";',
        'import type { ExecutionResult, RunState, RuntimeWorkflowNode, WaitSpec, WorkflowRuntimeError } from "./types";',
        "",
        "const RUNS_DIR = path.join('.pi', 'workflows', 'runs');",
        "const MAX_STEPS = 500;",
        "",
        "function newRunId(): string {",
        "  const rnd = Math.random().toString(36).slice(2, 8);",
        "  return `wf-${Date.now().toString(36)}-${rnd}`;",
        "}",
        "",
        "function isTerminal(run: RunState): boolean {",
        "  return run.status === 'done' || run.status === 'error' || run.status === 'cancelled';",
        "}",
        "",
        "export class WorkflowScheduler {",
        "  private runs = new Map<string, RunState>();",
        "  private childProcesses = new Map<string, ChildProcess>();",
        "",
        "  constructor(",
        "    private readonly pi: ExtensionAPI,",
        "    private readonly registry: WorkflowRegistry,",
        "    private readonly defaultWorkflowId: string",
        "  ) {}",
        "",
        "  async initialize(ctx: any): Promise<void> {",
        "    this.registry.loadFromDisk(ctx.cwd);",
        "    this.restoreRuns(ctx.cwd);",
        "    this.renderWidget(ctx);",
        "  }",
        "",
        "  listWorkflows() {",
        "    return this.registry.list();",
        "  }",
        "",
        "  listRuns(): RunState[] {",
        "    return [...this.runs.values()].sort((a, b) => b.updatedAt - a.updatedAt);",
        "  }",
        "",
        "  getRun(runId: string): RunState | undefined {",
        "    return this.runs.get(runId);",
        "  }",
        "",
        "  async startRun(workflowRef: string, variables: Record<string, unknown>, ctx: any): Promise<RunState | null> {",
        "    const workflow = this.registry.getByReference(workflowRef) ?? this.registry.getByReference(this.defaultWorkflowId);",
        "    if (!workflow) return null;",
        "",
        "    const now = Date.now();",
        "    const run: RunState = {",
        "      runId: newRunId(),",
        "      workflowId: workflow.workflowId,",
        "      status: 'pending',",
        "      currentNodeId: workflow.startNodeId,",
        "      variables: { ...variables },",
        "      outputs: {},",
        "      stack: [],",
        "      trace: [],",
        "      startedAt: now,",
        "      updatedAt: now,",
        "      stepCount: 0,",
        "    };",
        "",
        "    this.trace(run, 'run_started', undefined, `Workflow ${workflow.workflowId}`);",
        "    this.runs.set(run.runId, run);",
        "    this.persistRun(ctx.cwd, run);",
        "    this.renderWidget(ctx);",
        "",
        "    await this.driveRun(run, ctx);",
        "    return run;",
        "  }",
        "",
        "  async continueRun(runId: string, providedAnswer: string | undefined, ctx: any): Promise<boolean> {",
        "    const run = this.runs.get(runId);",
        "    if (!run || isTerminal(run)) return false;",
        "",
        "    if (run.status === 'waiting_user' && run.waitingFor) {",
        "      const handled = await this.resolveWaitingRun(run, providedAnswer, ctx);",
        "      if (!handled) return false;",
        "    } else if (run.status === 'paused' || run.status === 'pending') {",
        "      run.status = 'running';",
        "      run.updatedAt = Date.now();",
        "    } else if (run.status !== 'running') {",
        "      return false;",
        "    }",
        "",
        "    this.persistRun(ctx.cwd, run);",
        "    this.renderWidget(ctx);",
        "    await this.driveRun(run, ctx);",
        "    return true;",
        "  }",
        "",
        "  cancelRun(runId: string, ctx: any): boolean {",
        "    const run = this.runs.get(runId);",
        "    if (!run || isTerminal(run)) return false;",
        "",
        "    const proc = this.childProcesses.get(runId);",
        "    if (proc) {",
        "      try {",
        "        proc.kill('SIGTERM');",
        "      } catch {",
        "        // ignore",
        "      }",
        "      this.childProcesses.delete(runId);",
        "    }",
        "",
        "    run.status = 'cancelled';",
        "    run.lastError = {",
        "      code: 'WF_CANCELLED',",
        "      message: proc ? 'Run cancelled and child subprocess terminated' : 'Run cancelled by user',",
        "      nodeId: run.currentNodeId ?? undefined,",
        "    };",
        "    run.updatedAt = Date.now();",
        "    this.trace(run, 'cancelled', run.currentNodeId ?? undefined, run.lastError.message);",
        "",
        "    this.persistRun(ctx.cwd, run);",
        "    this.renderWidget(ctx);",
        "    return true;",
        "  }",
        "",
        "  clearRuns(ctx: any, clearAll: boolean): number {",
        "    let count = 0;",
        "",
        "    for (const [runId, run] of [...this.runs.entries()]) {",
        "      if (clearAll || isTerminal(run)) {",
        "        this.runs.delete(runId);",
        "        this.childProcesses.delete(runId);",
        "        count += 1;",
        "",
        "        const runFile = path.join(ctx.cwd, RUNS_DIR, `${runId}.json`);",
        "        if (fs.existsSync(runFile)) {",
        "          try {",
        "            fs.unlinkSync(runFile);",
        "          } catch {",
        "            // ignore",
        "          }",
        "        }",
        "      }",
        "    }",
        "",
        "    this.renderWidget(ctx);",
        "    return count;",
        "  }",
        "",
        "  private async driveRun(run: RunState, ctx: any): Promise<void> {",
        "    if (isTerminal(run)) return;",
        "",
        "    if (!run.currentNodeId) {",
        "      this.failRun(run, ctx.cwd, {",
        "        code: 'WF_NODE_MISSING',",
        "        message: 'Run has no active node',",
        "      });",
        "      this.renderWidget(ctx);",
        "      return;",
        "    }",
        "",
        "    run.status = 'running';",
        "",
        "    while (!isTerminal(run) && run.status === 'running') {",
        "      if (run.stepCount >= MAX_STEPS) {",
        "        this.failRun(run, ctx.cwd, {",
        "          code: 'WF_MAX_STEPS_EXCEEDED',",
        "          message: `Run exceeded max step count (${MAX_STEPS})`,",
        "          nodeId: run.currentNodeId ?? undefined,",
        "        });",
        "        break;",
        "      }",
        "",
        "      const workflow = this.registry.getById(run.workflowId);",
        "      if (!workflow) {",
        "        this.failRun(run, ctx.cwd, {",
        "          code: 'WF_WORKFLOW_MISSING',",
        "          message: `Workflow ${run.workflowId} not found`,",
        "        });",
        "        break;",
        "      }",
        "",
        "      const node = workflow.nodes.find((n) => n.id === run.currentNodeId);",
        "      if (!node) {",
        "        this.failRun(run, ctx.cwd, {",
        "          code: 'WF_NODE_MISSING',",
        "          message: `Node ${run.currentNodeId} not found in workflow ${run.workflowId}`,",
        "          nodeId: run.currentNodeId ?? undefined,",
        "        });",
        "        break;",
        "      }",
        "",
        "      run.stepCount += 1;",
        "      this.trace(run, 'node_enter', node.id, `${node.type}`);",
        "",
        "      const result = await this.executeNode(node, run, ctx);",
        "      await this.applyExecutionResult(run, workflow, node, result, ctx);",
        "",
        "      run.updatedAt = Date.now();",
        "      this.persistRun(ctx.cwd, run);",
        "      this.renderWidget(ctx);",
        "",
        "      if (run.status === 'waiting_user' || run.status === 'paused') {",
        "        break;",
        "      }",
        "    }",
        "",
        "    this.renderWidget(ctx);",
        "  }",
        "",
        "  private async executeNode(node: RuntimeWorkflowNode, run: RunState, ctx: any): Promise<ExecutionResult> {",
        "    const agentCtx: AgentExecutorContext = {",
        "      cwd: ctx.cwd,",
        "      activeModel: ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined,",
        "      onProcessStart: (proc) => {",
        "        this.childProcesses.set(run.runId, proc);",
        "        this.trace(run, 'agent_spawn', node.id, `Spawned subprocess for ${node.label}`);",
        "      },",
        "      onProcessEnd: () => {",
        "        this.childProcesses.delete(run.runId);",
        "      },",
        "      isCancelled: () => run.status === 'cancelled',",
        "    };",
        "",
        "    switch (node.type) {",
        "      case 'start':",
        "        return { type: 'advance', handle: 'output', message: 'Start node' };",
        "      case 'end':",
        "        return { type: 'complete', output: run.outputs[node.id], message: 'Workflow end reached' };",
        "      case 'prompt':",
        "        return executePromptNode(node, run);",
        "      case 'if-else':",
        "        return executeIfElseNode(node, run);",
        "      case 'switch':",
        "        return executeSwitchNode(node, run);",
        "      case 'ask-user':",
        "        return executeAskUserNode(node);",
        "      case 'sub-workflow':",
        "        return await executeSubWorkflowNode(node, run, agentCtx);",
        "      case 'agent':",
        "        return await executeAgentNode(node, run, agentCtx);",
        "      default:",
        "        return {",
        "          type: 'fail',",
        "          error: {",
        "            code: 'WF_NODE_EXECUTOR_MISSING',",
        "            nodeId: node.id,",
        "            message: `No executor for node type '${node.type}'`,",
        "          },",
        "        };",
        "    }",
        "  }",
        "",
        "  private async applyExecutionResult(",
        "    run: RunState,",
        "    workflow: any,",
        "    node: RuntimeWorkflowNode,",
        "    result: ExecutionResult,",
        "    ctx: any",
        "  ): Promise<void> {",
        "    if (result.type === 'fail') {",
        "      this.failRun(run, ctx.cwd, result.error);",
        "      return;",
        "    }",
        "",
        "    if (result.output !== undefined) {",
        "      run.outputs[node.id] = result.output;",
        "    }",
        "",
        "    if (result.type === 'wait') {",
        "      run.status = 'waiting_user';",
        "      run.waitingFor = result.wait;",
        "      this.trace(run, 'node_wait', node.id, result.message ?? 'Waiting for input');",
        "      ctx.ui.notify(`Run ${run.runId} is waiting for user input at ${node.label}`, 'info');",
        "      return;",
        "    }",
        "",
        "    if (result.type === 'enter_sub_workflow') {",
        "      const child = this.registry.getById(result.workflowId);",
        "      if (!child) {",
        "        this.failRun(run, ctx.cwd, {",
        "          code: 'WF_WORKFLOW_MISSING',",
        "          nodeId: node.id,",
        "          message: `Sub-workflow '${result.workflowId}' is missing`,",
        "        });",
        "        return;",
        "      }",
        "",
        "      const returnNodeId = resolveNextNode(workflow, node.id, [result.returnHandle ?? 'output', 'output']);",
        "      if (!returnNodeId && hasOutgoingTransition(workflow, node.id)) {",
        "        this.failRun(run, ctx.cwd, {",
        "          code: 'WF_TRANSITION_INVALID',",
        "          nodeId: node.id,",
        "          message: `No transition found for handle '${result.returnHandle ?? 'output'}'`,",
        "        });",
        "        return;",
        "      }",
        "      run.stack.push({",
        "        workflowId: run.workflowId,",
        "        returnNodeId,",
        "        fromNodeId: node.id,",
        "      });",
        "      run.workflowId = child.workflowId;",
        "      run.currentNodeId = child.startNodeId;",
        "      if (!run.currentNodeId) {",
        "        this.failRun(run, ctx.cwd, {",
        "          code: 'WF_START_MISSING',",
        "          nodeId: node.id,",
        "          message: `Sub-workflow '${child.workflowId}' has no start node`,",
        "        });",
        "        return;",
        "      }",
        "",
        "      this.trace(run, 'enter_sub_workflow', node.id, result.message ?? `Entering ${child.workflowId}`);",
        "      return;",
        "    }",
        "",
        "    if (result.type === 'complete') {",
        "      if (run.stack.length > 0) {",
        "        const frame = run.stack.pop()!;",
        "        run.workflowId = frame.workflowId;",
        "        run.currentNodeId = frame.returnNodeId;",
        "",
        "        if (!run.currentNodeId) {",
        "          run.status = 'done';",
        "          this.trace(run, 'run_done', frame.fromNodeId, 'Sub-workflow returned without return edge');",
        "        } else {",
        "          this.trace(run, 'return_sub_workflow', frame.fromNodeId, `Returned to ${run.currentNodeId}`);",
        "        }",
        "        return;",
        "      }",
        "",
        "      run.status = 'done';",
        "      run.currentNodeId = null;",
        "      this.trace(run, 'run_done', node.id, result.message ?? 'Completed');",
        "      return;",
        "    }",
        "",
        "    if (result.type === 'advance') {",
        "      if (node.type === 'agent' && result.output && typeof result.output === 'object') {",
        "        const agentOutput = result.output as Record<string, unknown>;",
        "        const preview =",
        "          typeof agentOutput.resultPreview === 'string'",
        "            ? agentOutput.resultPreview",
        "            : typeof agentOutput.resultText === 'string'",
        "              ? agentOutput.resultText.split('\\n').find((line) => line.trim().length > 0)",
        "              : undefined;",
        "",
        "        if (preview && preview.trim()) {",
        "          ctx.ui.notify(`Agent ${node.label}: ${preview.slice(0, 180)}`, 'info');",
        "        }",
        "      }",
        "",
        "      const nextNodeId = resolveNextNode(workflow, node.id, [result.handle ?? 'output', 'output']);",
        "      if (!nextNodeId) {",
        "        if (hasOutgoingTransition(workflow, node.id)) {",
        "          this.failRun(run, ctx.cwd, {",
        "            code: 'WF_TRANSITION_INVALID',",
        "            nodeId: node.id,",
        "            message: `No transition found for handle '${result.handle ?? 'output'}'`,",
        "          });",
        "          return;",
        "        }",
        "",
        "        run.status = 'done';",
        "        run.currentNodeId = null;",
        "        this.trace(run, 'run_done', node.id, 'No outgoing transition, run completed');",
        "        return;",
        "      }",
        "",
        "      run.currentNodeId = nextNodeId;",
        "      this.trace(run, 'node_advance', node.id, result.message ?? `→ ${nextNodeId}`);",
        "    }",
        "  }",
        "",
        "  private async resolveWaitingRun(run: RunState, providedAnswer: string | undefined, ctx: any): Promise<boolean> {",
        "    const wait = run.waitingFor;",
        "    if (!wait || wait.kind !== 'ask-user') return false;",
        "",
        "    const answer = await this.askUserAnswer(wait, providedAnswer, ctx);",
        "    if (answer === undefined) {",
        "      return false;",
        "    }",
        "",
        "    run.variables[wait.nodeId] = answer;",
        "    run.outputs[wait.nodeId] = { answer };",
        "",
        "    const workflow = this.registry.getById(run.workflowId);",
        "    if (!workflow) {",
        "      this.failRun(run, ctx.cwd, {",
        "        code: 'WF_WORKFLOW_MISSING',",
        "        message: `Workflow ${run.workflowId} not found while resuming`,",
        "      });",
        "      return true;",
        "    }",
        "",
        "    const handle = this.resolveAskUserHandle(wait, answer);",
        "    const nextNodeId = resolveNextNode(workflow, wait.nodeId, [handle, 'output']);",
        "    if (!nextNodeId) {",
        "      this.failRun(run, ctx.cwd, {",
        "        code: 'WF_TRANSITION_INVALID',",
        "        nodeId: wait.nodeId,",
        "        message: `No transition found for handle '${handle}'`,",
        "      });",
        "      return true;",
        "    }",
        "",
        "    run.waitingFor = undefined;",
        "    run.status = 'running';",
        "    run.currentNodeId = nextNodeId;",
        "    run.updatedAt = Date.now();",
        "    this.trace(run, 'user_input', wait.nodeId, `Selected ${JSON.stringify(answer)}`);",
        "    return true;",
        "  }",
        "",
        "  private async askUserAnswer(wait: WaitSpec, provided: string | undefined, ctx: any): Promise<unknown> {",
        "    if (provided && provided.trim()) {",
        "      if (wait.multipleSelection) {",
        "        return provided.split(',').map((s) => s.trim()).filter(Boolean);",
        "      }",
        "      return provided.trim();",
        "    }",
        "",
        "    if (wait.aiSuggestOptions || wait.multipleSelection || wait.options.length === 0) {",
        "      const input = await ctx.ui.input(wait.questionText, 'answer');",
        "      if (input === undefined) return undefined;",
        "      if (wait.multipleSelection) {",
        "        return input.split(',').map((s: string) => s.trim()).filter(Boolean);",
        "      }",
        "      return input.trim();",
        "    }",
        "",
        "    const labels = wait.options.map((opt) => opt.label || '(option)');",
        "    const selected = await ctx.ui.select(wait.questionText, labels);",
        "    if (selected === undefined) return undefined;",
        "    return selected;",
        "  }",
        "",
        "  private resolveAskUserHandle(wait: WaitSpec, answer: unknown): string {",
        "    if (wait.aiSuggestOptions || wait.multipleSelection) return 'output';",
        "",
        "    const asString = String(answer);",
        "    const idx = wait.options.findIndex((opt) => opt.label === asString);",
        "    if (idx >= 0) return `option-${idx}`;",
        "",
        "    const numeric = Number(asString);",
        "    if (Number.isFinite(numeric) && numeric >= 1 && numeric <= wait.options.length) {",
        "      return `option-${numeric - 1}`;",
        "    }",
        "",
        "    return 'output';",
        "  }",
        "",
        "  private trace(run: RunState, event: string, nodeId?: string, message?: string): void {",
        "    run.trace.push({ timestamp: Date.now(), event, nodeId, message });",
        "    if (run.trace.length > 500) {",
        "      run.trace = run.trace.slice(-500);",
        "    }",
        "  }",
        "",
        "  private failRun(run: RunState, cwd: string, error: WorkflowRuntimeError): void {",
        "    run.status = 'error';",
        "    run.lastError = error;",
        "    run.updatedAt = Date.now();",
        "    this.trace(run, 'run_error', error.nodeId, `${error.code}: ${error.message}`);",
        "    this.persistRun(cwd, run);",
        "  }",
        "",
        "  private persistRun(cwd: string, run: RunState): void {",
        "    const dir = path.join(cwd, RUNS_DIR);",
        "    fs.mkdirSync(dir, { recursive: true });",
        "    fs.writeFileSync(path.join(dir, `${run.runId}.json`), JSON.stringify(run, null, 2), 'utf8');",
        "",
        "    this.pi.appendEntry('workflow-runner-state', {",
        "      runId: run.runId,",
        "      workflowId: run.workflowId,",
        "      status: run.status,",
        "      currentNodeId: run.currentNodeId,",
        "      updatedAt: run.updatedAt,",
        "    });",
        "  }",
        "",
        "  private restoreRuns(cwd: string): void {",
        "    this.runs.clear();",
        "    const dir = path.join(cwd, RUNS_DIR);",
        "    if (!fs.existsSync(dir)) return;",
        "",
        "    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {",
        "      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;",
        "",
        "      try {",
        "        const raw = fs.readFileSync(path.join(dir, entry.name), 'utf8');",
        "        const run = JSON.parse(raw) as RunState;",
        "        if (!run?.runId) continue;",
        "",
        "        if (run.status === 'running') run.status = 'paused';",
        "        run.updatedAt = Date.now();",
        "        this.runs.set(run.runId, run);",
        "      } catch {",
        "        // ignore malformed run files",
        "      }",
        "    }",
        "  }",
        "",
        "  private renderWidget(ctx: any): void {",
        "    renderWorkflowWidget(ctx, this.listRuns());",
        "  }",
        "}",
        "",
      ].join("\n"),
    },
  ];
}

export function generatePiExtensionFiles(workflow: WorkflowJSON): GeneratedFile[] {
  const bundle = compileBundle(workflow);
  assertPiExtensionBundleExportable(bundle);

  const files: GeneratedFile[] = [];
  files.push(...getRuntimeFiles(bundle.rootWorkflowId));

  files.push({
    path: ".pi/workflows/workflow-runner.config.json",
    content: JSON.stringify(
      {
        rootWorkflowId: bundle.rootWorkflowId,
      },
      null,
      2
    ) + "\n",
  });

  for (const definition of bundle.definitions) {
    files.push({
      path: `.pi/workflows/${definition.workflowId}.json`,
      content: JSON.stringify(definition, null, 2) + "\n",
    });
  }

  for (const meta of bundle.metas) {
    files.push({
      path: `.pi/workflows/${meta.workflowId}.meta.json`,
      content: JSON.stringify(meta, null, 2) + "\n",
    });
  }

  files.push({
    path: "INSTALL.md",
    content: buildInstallDoc(bundle.rootWorkflowId),
  });

  files.push({
    path: "EXPORT_REPORT.md",
    content: buildExportReport(bundle, files),
  });

  return files;
}

export function getPiExtensionPreview(workflow: WorkflowJSON): string {
  const bundle = compileBundle(workflow);
  return buildPreview(bundle);
}
