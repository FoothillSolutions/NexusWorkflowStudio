/**
 * workflow-generator.ts
 *
 * Converts a WorkflowJSON into one or more file artifacts for the "Generate"
 * feature.  Designed to be easily extended as new node types are introduced.
 */

import type {
  WorkflowJSON,
  WorkflowNode,
  WorkflowEdge,
  PromptNodeData,
  SubAgentNodeData,
  SubAgentFlowNodeData,
  SkillNodeData,
  McpToolNodeData,
  IfElseNodeData,
  SwitchNodeData,
  AskUserNodeData,
} from "@/types/workflow";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedFile {
  /** Path relative to the zip root, e.g. "commands/my-workflow.md" */
  path: string;
  content: string;
}

// ── Mermaid ID helpers ───────────────────────────────────────────────────────

/** Convert a node id into a safe Mermaid node identifier */
function mermaidId(nodeId: string): string {
  // Replace non-alphanumeric characters with underscore
  return nodeId.replace(/[^a-zA-Z0-9]/g, "_");
}

/** Convert a string to a safe Mermaid label (escape quotes) */
function mermaidLabel(text: string): string {
  return text.replace(/"/g, "'");
}

// ── Shape per node type ───────────────────────────────────────────────────────

/**
 * Returns the Mermaid shape syntax for a node.
 *
 * Shape conventions:
 *   start / end   → stadium  (([label]))
 *   ask-user      → diamond  {label}
 *   if-else       → diamond  {label}
 *   switch        → diamond  {label}
 *   sub-agent     → rectangle [label]
 *   sub-agent-flow→ rectangle [label]
 *   prompt        → rectangle [label]
 *   skill         → rectangle [label]
 *   mcp-tool      → rectangle [label]
 */
function mermaidNodeShape(node: WorkflowNode): string {
  const id = mermaidId(node.id);
  const data = node.data;

  // Build the display label
  let displayLabel: string;
  switch (data.type) {
    case "start":
      displayLabel = "Start";
      break;
    case "end":
      displayLabel = "End";
      break;
    case "sub-agent":
      displayLabel = `Sub-Agent: ${mermaidLabel((data as SubAgentNodeData).name || data.label)}`;
      break;
    case "sub-agent-flow":
      displayLabel = `Sub-Agent Flow: ${mermaidLabel((data as SubAgentFlowNodeData).flowRef || data.label)}`;
      break;
    case "prompt":
      displayLabel = mermaidLabel(data.label || data.name);
      break;
    case "skill":
      displayLabel = `Skill: ${mermaidLabel((data as SkillNodeData).skillName || data.label)}`;
      break;
    case "mcp-tool":
      displayLabel = `MCP Tool: ${mermaidLabel((data as McpToolNodeData).toolName || data.label)}`;
      break;
    case "if-else": {
      const expr = (data as IfElseNodeData).expression;
      displayLabel = expr ? `Branch: ${mermaidLabel(expr)}` : `Branch: ${mermaidLabel(data.label)}`;
      break;
    }
    case "switch": {
      const expr = (data as SwitchNodeData).switchExpr;
      displayLabel = expr ? `Switch: ${mermaidLabel(expr)}` : `Switch: ${mermaidLabel(data.label)}`;
      break;
    }
    case "ask-user": {
      const q = (data as AskUserNodeData).questionText;
      displayLabel = q ? `AskUserQuestion: ${mermaidLabel(q)}` : `AskUserQuestion: ${mermaidLabel(data.label)}`;
      break;
    }
    default: {
      const fallback = data as { label?: string; type?: string };
      displayLabel = mermaidLabel(fallback.label || fallback.type || "node");
    }
  }

  // Apply shape
  switch (data.type) {
    case "start":
    case "end":
      return `    ${id}(["${displayLabel}"])`;
    case "if-else":
    case "switch":
    case "ask-user":
      return `    ${id}{"${displayLabel}"}`;
    default:
      return `    ${id}["${displayLabel}"]`;
  }
}

// ── Edge labels ───────────────────────────────────────────────────────────────

function mermaidEdge(edge: WorkflowEdge): string {
  const srcId = mermaidId(edge.source);
  const tgtId = mermaidId(edge.target);

  // Only show a label for meaningful handles (not the default "output"/"input")
  const defaultHandles = new Set(["output", "input"]);
  const showLabel = edge.sourceHandle && !defaultHandles.has(edge.sourceHandle);
  const label = showLabel ? ` -- "${mermaidLabel(edge.sourceHandle!)}" -->` : " -->";
  return `    ${srcId}${label} ${tgtId}`;
}

// ── Topological sort (BFS from start) ────────────────────────────────────────

/**
 * Returns node IDs in BFS order starting from nodes with no incoming edges
 * (i.e., start nodes).  Used to order the Prompt Node Details by flow order.
 */
function topologicalOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const adjMap = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adjMap.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adjMap.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) {
      queue.push(node.id);
    }
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of (adjMap.get(id) ?? [])) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  return order;
}

// ── Prompt node details section ───────────────────────────────────────────────

/**
 * Build the "### Prompt Node Details" section, listing all prompt nodes in
 * topological (flow) order.
 *
 * Format per node:
 *   #### nodeId(Node Label)
 *   ```md
 *   <prompt text>
 *   ```
 */
function buildPromptDetailsSection(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const order = topologicalOrder(nodes, edges);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));

  const sections: string[] = [];

  for (const id of order) {
    const node = nodeById.get(id);
    if (!node || node.data.type !== "prompt") continue;

    const d = node.data as PromptNodeData;
    const safeId = mermaidId(node.id);
    const nodeLabel = d.label || d.name;

    sections.push([
      `#### ${safeId}(${nodeLabel})`,
      "",
      "```md",
      d.promptText ?? "",
      "```",
    ].join("\n"));
  }

  if (sections.length === 0) return "";

  return "### Prompt Node Details\n\n" + sections.join("\n\n");
}

// ── Details section builder ───────────────────────────────────────────────────

/**
 * Build the "## Node Details" section for non-prompt nodes.
 * Prompt nodes are handled separately in buildPromptDetailsSection.
 */
function buildDetailsSection(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const order = topologicalOrder(nodes, edges);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));

  const sections: string[] = [];

  for (const id of order) {
    const node = nodeById.get(id);
    if (!node) continue;
    const data = node.data;

    switch (data.type) {
      case "start":
      case "end":
      case "prompt":
        // terminal nodes and prompts handled elsewhere
        break;

      case "sub-agent": {
        const d = data as SubAgentNodeData;
        const nodeLabel = d.name || d.label;
        const rows = [
          `#### Sub-Agent: ${nodeLabel}`,
          "",
          `- **Model:** ${d.model}`,
          `- **Memory:** ${d.memory}`,
        ];
        if (d.tools) rows.push(`- **Tools:** ${d.tools}`);
        if (d.promptText) {
          rows.push("", "**Prompt:**", "```", d.promptText, "```");
        }
        if (d.detectedVariables.length > 0) {
          rows.push(
            "",
            `**Variables:** ${d.detectedVariables.map((v) => `\`${v}\``).join(", ")}`
          );
        }
        sections.push(rows.join("\n"));
        break;
      }

      case "sub-agent-flow": {
        const d = data as SubAgentFlowNodeData;
        const nodeLabel = d.name || d.label;
        sections.push([
          `#### Sub-Agent Flow: ${nodeLabel}`,
          "",
          `- **Flow Reference:** ${d.flowRef || "_not set_"}`,
          `- **Node Count:** ${d.nodeCount}`,
        ].join("\n"));
        break;
      }

      case "skill": {
        const d = data as SkillNodeData;
        const nodeLabel = d.name || d.label;
        sections.push([
          `#### Skill: ${nodeLabel}`,
          "",
          `- **Skill Name:** ${d.skillName || "_not set_"}`,
          `- **Project:** ${d.projectName || "_not set_"}`,
        ].join("\n"));
        break;
      }

      case "mcp-tool": {
        const d = data as McpToolNodeData;
        const nodeLabel = d.name || d.label;
        const rows = [
          `#### MCP Tool: ${nodeLabel}`,
          "",
          `- **Tool Name:** ${d.toolName || "_not set_"}`,
        ];
        if (d.paramsText) {
          rows.push("", "**Parameters:**", "```", d.paramsText, "```");
        }
        sections.push(rows.join("\n"));
        break;
      }

      case "if-else": {
        const d = data as IfElseNodeData;
        const nodeLabel = d.name || d.label;
        sections.push([
          `#### Branch: ${nodeLabel}`,
          "",
          `- **Expression:** ${d.expression || "_not set_"}`,
        ].join("\n"));
        break;
      }

      case "switch": {
        const d = data as SwitchNodeData;
        const nodeLabel = d.name || d.label;
        const caseList = d.cases.map((c) => `  - ${c}`).join("\n");
        sections.push([
          `#### Switch: ${nodeLabel}`,
          "",
          `- **Expression:** ${d.switchExpr || "_not set_"}`,
          `- **Cases:**`,
          caseList,
        ].join("\n"));
        break;
      }

      case "ask-user": {
        const d = data as AskUserNodeData;
        const nodeLabel = d.name || d.label;
        const optList = d.options.map((o) => `  - ${o}`).join("\n");
        sections.push([
          `#### AskUserQuestion: ${nodeLabel}`,
          "",
          `- **Question:** ${d.questionText || "_not set_"}`,
          `- **Options:**`,
          optList,
        ].join("\n"));
        break;
      }

      // ── Add future node types here ─────────────────────────────────────
    }
  }

  if (sections.length === 0) return "";

  return ["## Node Details", "", ...sections].join("\n\n");
}

// ── Main command markdown builder ─────────────────────────────────────────────

function buildCommandMarkdown(workflow: WorkflowJSON): string {
  const { name, nodes, edges } = workflow;

  // ── Mermaid flowchart ──────────────────────────────────────────────────
  // Deduplicate start/end nodes: only one of each type appears in the chart.
  // Extra end nodes are collapsed into the first one found.
  const seenTypes = new Set<string>();
  const endNodeIdMap = new Map<string, string>(); // extra end node id → canonical end id
  let canonicalEndId: string | null = null;

  const dedupedNodes = nodes.filter((n) => {
    if (n.data.type === "start" || n.data.type === "end") {
      if (!seenTypes.has(n.data.type)) {
        seenTypes.add(n.data.type);
        if (n.data.type === "end") canonicalEndId = n.id;
        return true;
      }
      // Extra end node — map its id to the canonical one
      if (n.data.type === "end" && canonicalEndId) {
        endNodeIdMap.set(n.id, canonicalEndId);
      }
      return false;
    }
    return true;
  });

  // Remap edges that point to a removed duplicate end node
  const remappedEdges = edges.map((e) => {
    const remappedTarget = endNodeIdMap.get(e.target);
    const remappedSource = endNodeIdMap.get(e.source);
    if (remappedTarget || remappedSource) {
      return {
        ...e,
        target: remappedTarget ?? e.target,
        source: remappedSource ?? e.source,
      };
    }
    return e;
  });

  const nodeLines = dedupedNodes.map(mermaidNodeShape);
  const edgeLines = remappedEdges.map((e) => mermaidEdge(e));

  // Blank line between node declarations and edge declarations
  const mermaidInner = edgeLines.length > 0
    ? [...nodeLines, "", ...edgeLines]
    : nodeLines;

  const mermaidBlock = [
    "```mermaid",
    "flowchart TD",
    ...mermaidInner,
    "```",
  ].join("\n");

  // ── Execution guide ────────────────────────────────────────────────────
  const executionGuide = `## Workflow Execution Guide

Follow the Mermaid flowchart above to execute the workflow. Each node type has specific execution methods as described below.

### Execution Methods by Node Type

- **Stadium nodes (Start / End)**: Entry and exit points of the workflow
- **Rectangle nodes (Sub-Agent: ...)**: Execute Sub-Agents
- **Diamond nodes (AskUserQuestion:...)**: Use the AskUserQuestion tool to prompt the user and branch based on their response
- **Diamond nodes (Branch/Switch:...)**: Automatically branch based on the results of previous processing (see details section)
- **Rectangle nodes (Prompt nodes)**: Execute the prompts described in the details section below`;

  // ── Prompt details section (flow-ordered) ─────────────────────────────
  const promptDetails = buildPromptDetailsSection(nodes, edges);

  // ── Other node details section ────────────────────────────────────────
  const otherDetails = buildDetailsSection(nodes, edges);

  // ── Front-matter ───────────────────────────────────────────────────────
  const frontmatter = `---\ndescription: ${name}\n---`;

  const parts = [frontmatter, mermaidBlock, "", executionGuide];
  if (promptDetails) parts.push("", promptDetails);
  if (otherDetails) parts.push("", otherDetails);

  return parts.join("\n") + "\n";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate all files that should be included in the output zip.
 * Returns an array of { path, content } objects.
 *
 * Folder structure:
 *   commands/<workflow-name>.md
 *   agents/   (reserved for future use)
 */
export function generateWorkflowFiles(workflow: WorkflowJSON): GeneratedFile[] {
  const safeName = workflow.name
    .replace(/[^a-z0-9\-_ ]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase() || "workflow";

  return [
    {
      path: `commands/${safeName}.md`,
      content: buildCommandMarkdown(workflow),
    },
    // Future: agents/<agent-name>.md entries would be pushed here
  ];
}

/**
 * Returns just the command markdown string (used for preview).
 */
export function getCommandMarkdown(workflow: WorkflowJSON): string {
  return buildCommandMarkdown(workflow);
}

