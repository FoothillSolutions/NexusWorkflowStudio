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
      displayLabel = `Prompt: ${mermaidLabel(data.name || data.label)}`;
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

  // Derive a label from the source handle if present
  const label = edge.sourceHandle ? ` -- "${mermaidLabel(edge.sourceHandle)}" -->` : " -->";
  return `    ${srcId}${label} ${tgtId}`;
}

// ── Details section builder ───────────────────────────────────────────────────

/**
 * Build the "Details" section at the bottom of the markdown.
 * Each node type that carries meaningful data gets its own sub-section.
 * Add more cases here as new node types are added.
 */
function buildDetailsSection(nodes: WorkflowNode[]): string {
  const sections: string[] = [];

  for (const node of nodes) {
    const data = node.data;

    switch (data.type) {
      case "start":
      case "end":
        // No details needed for terminal nodes
        break;

      case "prompt": {
        const d = data as PromptNodeData;
        const nodeLabel = d.name || d.label;
        sections.push([
          `#### Prompt: ${nodeLabel}`,
          "",
          d.promptText
            ? "```\n" + d.promptText + "\n```"
            : "_No prompt text defined._",
          d.detectedVariables.length > 0
            ? `\n**Variables:** ${d.detectedVariables.map((v) => `\`${v}\``).join(", ")}`
            : "",
        ].filter((l) => l !== undefined).join("\n"));
        break;
      }

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
  const nodeLines = nodes.map(mermaidNodeShape);
  const edgeLines = edges.map((e) => mermaidEdge(e));

  const mermaidBlock = [
    "```mermaid",
    "flowchart TD",
    ...nodeLines,
    ...(edgeLines.length > 0 ? edgeLines : []),
    "```",
  ].join("\n");

  // ── Execution guide ────────────────────────────────────────────────────
  const executionGuide = `## Workflow Execution Guide

Follow the Mermaid flowchart above to execute the workflow. Each node type has specific execution methods as described below.

### Execution Methods by Node Type

- **Stadium nodes (Start / End)**: Entry and exit points of the workflow
- **Rectangle nodes (Sub-Agent: ...)**: Execute Sub-Agents
- **Rectangle nodes (Sub-Agent Flow: ...)**: Execute a referenced sub-agent flow
- **Diamond nodes (AskUserQuestion: ...)**: Use the AskUserQuestion tool to prompt the user and branch based on their response
- **Diamond nodes (Branch / Switch: ...)**: Automatically branch based on the results of previous processing (see details section)
- **Rectangle nodes (Prompt: ...)**: Execute the prompts described in the details section below
- **Rectangle nodes (Skill: ...)**: Execute the specified skill
- **Rectangle nodes (MCP Tool: ...)**: Call the specified MCP tool with the given parameters`;

  // ── Details section ────────────────────────────────────────────────────
  const details = buildDetailsSection(nodes);

  // ── Front-matter ───────────────────────────────────────────────────────
  const frontmatter = `---\ndescription: ${name}\n---`;

  const parts = [frontmatter, "", mermaidBlock, "", executionGuide];
  if (details) parts.push("", details);

  return parts.join("\n");
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

