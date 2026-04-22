/**
 * workflow-generator.ts
 *
 * Converts a WorkflowJSON into one or more file artifacts for the "Generate"
 * feature. Orchestrates per-node generator modules; all node-specific logic
 * lives in src/nodes/<type>/generator.ts.
 */
import { WorkflowNodeType, type WorkflowEdge, type WorkflowJSON, type WorkflowNode } from "@/types/workflow";
import type { AgentHandoffContext, NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId } from "@/nodes/shared/mermaid-utils";
import { getDocumentRelativePath } from "@/nodes/document/utils";
import {
  buildHandoffPayloadTemplate,
  resolveHandoffFilePath,
} from "@/nodes/handoff/generator";
import type { HandoffNodeData } from "@/nodes/handoff/types";
import {
  buildGeneratedCommandFilePath,
  buildGeneratedSkillScriptFilePath,
  DEFAULT_GENERATION_TARGET,
  sanitizeGeneratedName,
  type GenerationTargetId,
} from "@/lib/generation-targets";
import { getSkillScriptBaseName, getSkillScriptFileName } from "@/nodes/skill/script-utils";
import { generateRunScriptFiles } from "@/lib/run-script-generator";
import {
  buildAskUserDetailsSection,
  buildDetailsSection,
  buildHandoffDetailsSection,
  buildIfElseDetailsSection,
  buildParallelAgentDetailsSection,
  buildPromptDetailsSection,
  buildSubAgentDetailsSection,
  buildSubWorkflowDetailsSection,
  buildSwitchDetailsSection,
} from "@/lib/workflow-generation/detail-sections";
import {
  filterReachable,
  type GeneratedFile,
  mermaidEdge,
  mermaidNodeShape,
  NODE_GENERATORS,
  resolveSkillReferenceName,
  topologicalOrder,
} from "@/lib/workflow-generation/shared";

export type { GeneratedFile } from "@/lib/workflow-generation/shared";

function collectConnectedNodeIds(nodesByTarget: Map<string, string[]>): Set<string> {
  const ids = new Set<string>();
  for (const connectedIds of nodesByTarget.values()) {
    for (const id of connectedIds) ids.add(id);
  }
  return ids;
}

/**
 * For a given agent-like node, look up any directly-connected handoff neighbours
 * (upstream: handoff → agent; downstream: agent → handoff) and build an
 * AgentHandoffContext describing them. Returns undefined when the agent has
 * no handoff neighbours.
 */
function buildAgentHandoffContext(
  agentNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): AgentHandoffContext | undefined {
  const nodeById = new Map<string, WorkflowNode>(nodes.map((node) => [node.id, node]));
  let context: AgentHandoffContext | undefined;

  // Upstream: edge whose target is the agent and whose source is a handoff node.
  const upstreamEdge = edges.find(
    (edge) =>
      edge.target === agentNodeId &&
      (edge.targetHandle ?? "input") === "input" &&
      nodeById.get(edge.source)?.data.type === WorkflowNodeType.Handoff,
  );
  if (upstreamEdge) {
    const handoffNode = nodeById.get(upstreamEdge.source);
    if (handoffNode?.data.type === WorkflowNodeType.Handoff) {
      const d = handoffNode.data as HandoffNodeData;
      const mode = d.mode ?? "file";
      const filePath = resolveHandoffFilePath(handoffNode.id, d);
      const payloadTemplate = buildHandoffPayloadTemplate(handoffNode.id, d);
      // The "other agent" across the handoff is the handoff's upstream source.
      const intoHandoffEdge = edges.find(
        (edge) => edge.target === handoffNode.id && (edge.targetHandle ?? "input") === "input",
      );
      context ??= {};
      context.upstream = {
        handoffNodeId: handoffNode.id,
        mode,
        filePath,
        payloadTemplate,
        otherAgentId: intoHandoffEdge?.source,
      };
    }
  }

  // Downstream: edge whose source is the agent and whose target is a handoff node.
  const downstreamEdge = edges.find(
    (edge) =>
      edge.source === agentNodeId &&
      (edge.sourceHandle ?? "output") === "output" &&
      nodeById.get(edge.target)?.data.type === WorkflowNodeType.Handoff,
  );
  if (downstreamEdge) {
    const handoffNode = nodeById.get(downstreamEdge.target);
    if (handoffNode?.data.type === WorkflowNodeType.Handoff) {
      const d = handoffNode.data as HandoffNodeData;
      const mode = d.mode ?? "file";
      const filePath = resolveHandoffFilePath(handoffNode.id, d);
      const payloadTemplate = buildHandoffPayloadTemplate(handoffNode.id, d);
      // The "other agent" across the handoff is the handoff's downstream target.
      const outOfHandoffEdge = edges.find(
        (edge) => edge.source === handoffNode.id && (edge.sourceHandle ?? "output") === "output",
      );
      context ??= {};
      context.downstream = {
        handoffNodeId: handoffNode.id,
        mode,
        filePath,
        payloadTemplate,
        otherAgentId: outOfHandoffEdge?.target,
      };
    }
  }

  return context;
}

function collectAgentFiles(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  target: GenerationTargetId,
): GeneratedFile[] {
  const { nodes: reachable } = filterReachable(nodes, edges);
  const reachableIds = new Set(reachable.map((node) => node.id));
  const allNodeById = new Map<string, WorkflowNode>(nodes.map((node) => [node.id, node]));

  const skillsByTarget = new Map<string, string[]>();
  const docsByTarget = new Map<string, string[]>();
  const scriptsBySkill = new Map<string, string[]>();

  for (const edge of edges) {
    const targetNode = allNodeById.get(edge.target);
    const sourceNode = allNodeById.get(edge.source);

    if (
      edge.sourceHandle === "skill-out" &&
      reachableIds.has(edge.target) &&
      (targetNode?.data.type === WorkflowNodeType.Agent ||
        targetNode?.data.type === WorkflowNodeType.ParallelAgent) &&
      sourceNode?.data.type === WorkflowNodeType.Skill
    ) {
      if (!skillsByTarget.has(edge.target)) skillsByTarget.set(edge.target, []);
      skillsByTarget.get(edge.target)?.push(edge.source);
    }

    if (
      edge.sourceHandle === "doc-out" &&
      reachableIds.has(edge.target) &&
      (targetNode?.data.type === WorkflowNodeType.Agent ||
        targetNode?.data.type === WorkflowNodeType.ParallelAgent) &&
      sourceNode?.data.type === WorkflowNodeType.Document
    ) {
      if (!docsByTarget.has(edge.target)) docsByTarget.set(edge.target, []);
      docsByTarget.get(edge.target)?.push(edge.source);
    }

    if (
      edge.targetHandle === "scripts" &&
      targetNode?.data.type === WorkflowNodeType.Skill &&
      sourceNode?.data.type === WorkflowNodeType.Script
    ) {
      if (!scriptsBySkill.has(edge.target)) scriptsBySkill.set(edge.target, []);
      scriptsBySkill.get(edge.target)?.push(edge.source);
    }
  }

  const connectedSkillIds = collectConnectedNodeIds(skillsByTarget);
  const connectedDocIds = collectConnectedNodeIds(docsByTarget);
  const files: GeneratedFile[] = [];

  for (const node of reachable) {
    if (node.data.type !== WorkflowNodeType.Agent) continue;

    const skillIds = skillsByTarget.get(node.id) ?? [];
    const connectedSkillNames = skillIds.flatMap((skillId) => {
      const skillNode = allNodeById.get(skillId);
      if (skillNode?.data.type !== WorkflowNodeType.Skill) return [];

      const skillName = resolveSkillReferenceName(
        skillNode.data as import("@/nodes/skill/types").SkillNodeData,
      );
      return skillName ? [skillName] : [];
    });

    const docIds = docsByTarget.get(node.id) ?? [];
    const connectedDocNames = docIds.flatMap((docId) => {
      const docNode = allNodeById.get(docId);
      if (docNode?.data.type !== WorkflowNodeType.Document) return [];

      const relativePath = getDocumentRelativePath(
        docNode.data as import("@/nodes/document/types").DocumentNodeData,
      );
      return relativePath ? [relativePath] : [];
    });

    const handoffContext = buildAgentHandoffContext(node.id, nodes, edges);
    const generator = NODE_GENERATORS[node.data.type];
    const file = generator?.getAgentFile?.(
      node.id,
      node.data,
      connectedSkillNames,
      connectedDocNames,
      target,
      handoffContext,
    );
    if (file) files.push(file);
  }

  for (const skillId of connectedSkillIds) {
    const skillNode = allNodeById.get(skillId);
    if (skillNode?.data.type !== WorkflowNodeType.Skill) continue;

    const generator = NODE_GENERATORS.skill;
    const skillData = skillNode.data as import("@/nodes/skill/types").SkillNodeData;
    const skillName = resolveSkillReferenceName(skillData);
    const connectedScripts = (scriptsBySkill.get(skillId) ?? [])
      .map((scriptId) => allNodeById.get(scriptId))
      .filter((node): node is WorkflowNode => !!node && node.data.type === WorkflowNodeType.Script)
      .map((node) => ({
        label: (node.data.label as string) || node.id,
        fileName: getSkillScriptFileName(node.data),
        variableName: getSkillScriptBaseName(node.data),
        content: (node.data.promptText as string) || "",
      }));

    const skillFile = generator?.getSkillFile?.(
      skillNode.id,
      skillNode.data,
      connectedScripts,
      target,
    );
    if (skillFile) files.push(skillFile);

    if (!skillName) continue;

    for (const script of connectedScripts) {
      files.push({
        path: buildGeneratedSkillScriptFilePath(skillName, script.fileName, target),
        content: script.content.endsWith("\n")
          ? script.content
          : `${script.content}\n`,
      });
    }
  }

  for (const docId of connectedDocIds) {
    const docNode = allNodeById.get(docId);
    if (docNode?.data.type !== WorkflowNodeType.Document) continue;

    const file = NODE_GENERATORS.document?.getDocFile?.(
      docNode.id,
      docNode.data,
      target,
    );
    if (file) files.push(file);
  }

  for (const node of reachable) {
    if (node.data.type !== WorkflowNodeType.SubWorkflow) continue;

    const generator = NODE_GENERATORS[WorkflowNodeType.SubWorkflow] as NodeGeneratorModule & {
      getSubWorkflowJSON?(id: string, data: WorkflowNode["data"]): WorkflowJSON | null;
    };
    const subWorkflowData = node.data as import("@/nodes/sub-workflow/types").SubWorkflowNodeData;
    const innerJSON = generator.getSubWorkflowJSON?.(node.id, node.data);
    if (!innerJSON) continue;

    if (subWorkflowData.mode === "agent") {
      files.push(...generateWorkflowFiles(innerJSON, target));

      const agentFile = generator.getAgentFile?.(
        node.id,
        node.data,
        undefined,
        undefined,
        target,
      );
      if (agentFile) files.push(agentFile);
      continue;
    }

    files.push({
      path: buildGeneratedCommandFilePath(mermaidId(node.id), target),
      content: buildCommandMarkdown(innerJSON, target),
    });
    files.push(...collectAgentFiles(innerJSON.nodes, innerJSON.edges, target));
  }

  return files;
}

function buildCommandMarkdown(
  workflow: WorkflowJSON,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): string {
  const { name } = workflow;
  const { nodes, edges } = filterReachable(workflow.nodes, workflow.edges);
  const seenTypes = new Set<string>();
  const endNodeIdMap = new Map<string, string>();
  let canonicalEndId: string | null = null;

  const dedupedNodes = nodes.filter((node) => {
    if (node.data.type === WorkflowNodeType.Skill) return false;
    if (node.data.type === WorkflowNodeType.Document) return false;
    if (node.data.type === WorkflowNodeType.Script) return false;

    if (node.data.type === WorkflowNodeType.Start || node.data.type === WorkflowNodeType.End) {
      if (!seenTypes.has(node.data.type)) {
        seenTypes.add(node.data.type);
        if (node.data.type === WorkflowNodeType.End) canonicalEndId = node.id;
        return true;
      }

      if (node.data.type === WorkflowNodeType.End && canonicalEndId) {
        endNodeIdMap.set(node.id, canonicalEndId);
      }
      return false;
    }

    return true;
  });

  const skillNodeIds = new Set(
    nodes.filter((node) => node.data.type === WorkflowNodeType.Skill).map((node) => node.id),
  );
  const documentNodeIds = new Set(
    nodes.filter((node) => node.data.type === WorkflowNodeType.Document).map((node) => node.id),
  );
  const scriptNodeIds = new Set(
    nodes.filter((node) => node.data.type === WorkflowNodeType.Script).map((node) => node.id),
  );

  const remappedEdges = edges
    .filter(
      (edge) =>
        !skillNodeIds.has(edge.source) &&
        !skillNodeIds.has(edge.target) &&
        !documentNodeIds.has(edge.source) &&
        !documentNodeIds.has(edge.target) &&
        !scriptNodeIds.has(edge.source) &&
        !scriptNodeIds.has(edge.target),
    )
    .map((edge) => {
      const remappedTarget = endNodeIdMap.get(edge.target);
      const remappedSource = endNodeIdMap.get(edge.source);
      if (!remappedTarget && !remappedSource) return edge;

      return {
        ...edge,
        target: remappedTarget ?? edge.target,
        source: remappedSource ?? edge.source,
      };
    });

  const topoOrder = topologicalOrder(dedupedNodes, remappedEdges);
  const topoIndex = new Map<string, number>(
    topoOrder.map((id, index) => [id, index]),
  );
  const sortedEdges = [...remappedEdges].sort((a, b) => {
    const sourceDelta = (topoIndex.get(a.source) ?? Infinity) - (topoIndex.get(b.source) ?? Infinity);
    if (sourceDelta !== 0) return sourceDelta;

    return (topoIndex.get(a.target) ?? Infinity) - (topoIndex.get(b.target) ?? Infinity);
  });

  const nodeLines = dedupedNodes.map(mermaidNodeShape).filter(Boolean);
  const nodeById = new Map<string, WorkflowNode>(nodes.map((node) => [node.id, node]));
  const edgeLines = sortedEdges.map((edge) => mermaidEdge(edge, nodeById));
  const mermaidInner = edgeLines.length > 0 ? [...nodeLines, "", ...edgeLines] : nodeLines;
  const mermaidBlock = ["```mermaid", "flowchart TD", ...mermaidInner, "```"].join("\n");

  const startNodeId = nodes.find((node) => node.data.type === WorkflowNodeType.Start)?.id ?? WorkflowNodeType.Start;
  const executionGuide = `## Workflow Execution Guide
Follow the Mermaid flowchart above to execute the workflow starting from \`${mermaidId(startNodeId)}\` node. Each node type has specific execution methods as described below.
Split each flow path into a todo item using todowrite and todoread tools, and update the todo list correspondingly.

### Context Isolation Between Steps
Each dispatched Agent step runs in an isolated context. **Do NOT pass results, output, or context from one step into the next** by default. Exceptions:
- **Handoff nodes** on the edge between two steps — follow the handoff node's payload template to carry exactly the declared fields forward (file-mode: read/write the handoff file; context-mode: inline the "Handoff Payload" section into the next agent's prompt).
- **Parallel Agent dispatches** — the shared instructions and each branch's per-instance inputs define what every spawned agent receives; no additional context flows in beyond those.

If neither a Handoff node nor a Parallel Agent dispatch is present, treat the next step as a fresh dispatch with only the inputs declared in its own dispatch block.

### Positional Arguments
Workflow arguments are **comma-separated and trimmed**. For example \`/workflow 2, 5, 10\` yields \`$1=2\`, \`$2=5\`, \`$3=10\`.

### Execution Methods by Node Type
- **Stadium nodes (Start / End)**: Entry and exit points of the workflow
- **Rectangle nodes (Agent: ...)**: Execute Agents via the spawn agent delegation system. If a \`params:\` line is present, pass those values as the agent's positional arguments (\`$1\`, \`$2\`, …). Values can be workflow-level positional args (e.g. \`$1\`), static references (e.g. \`{{name}}\`), or literal strings
- **Rectangle nodes (Parallel Agent: ...)**: For each branch handle, spawn the connected downstream agent the configured number of times and follow each branch independently
- **Diamond nodes (AskUserQuestion:...)**: Use the AskUserQuestion tool to prompt the user and branch based on their response
- **Diamond nodes (Branch/Switch:...)**: Automatically branch based on the results of previous processing (see details section)
- **Rectangle nodes (Prompt nodes)**: Execute the prompts described in the details section below`;

  const promptDetails = buildPromptDetailsSection(nodes, edges);
  const subAgentDetails = buildSubAgentDetailsSection(
    nodes,
    edges,
    workflow.nodes,
    workflow.edges,
    target,
  );
  const parallelAgentDetails = buildParallelAgentDetailsSection(nodes, edges, target);
  const ifElseDetails = buildIfElseDetailsSection(nodes, edges);
  const switchDetails = buildSwitchDetailsSection(nodes, edges);
  const askUserDetails = buildAskUserDetailsSection(nodes, edges);
  const subWorkflowDetails = buildSubWorkflowDetailsSection(nodes, edges);
  const handoffDetails = buildHandoffDetailsSection(nodes, edges, target);
  const otherDetails = buildDetailsSection(nodes, edges);

  const frontmatter = `---\ndescription: ${name}\n---`;
  const parts = [frontmatter, mermaidBlock, "", executionGuide];

  if (promptDetails) parts.push("", promptDetails);
  if (subAgentDetails) parts.push("", subAgentDetails);
  if (parallelAgentDetails) parts.push("", parallelAgentDetails);
  if (subWorkflowDetails) parts.push("", subWorkflowDetails);
  if (ifElseDetails) parts.push("", ifElseDetails);
  if (switchDetails) parts.push("", switchDetails);
  if (askUserDetails) parts.push("", askUserDetails);
  if (handoffDetails) parts.push("", handoffDetails);
  if (otherDetails) parts.push("", otherDetails);

  return `${parts.join("\n")}\n`;
}

export function generateWorkflowFiles(
  workflow: WorkflowJSON,
  target: GenerationTargetId = DEFAULT_GENERATION_TARGET,
): GeneratedFile[] {
  const safeName = sanitizeGeneratedName(workflow.name);
  const commandFile: GeneratedFile = {
    path: buildGeneratedCommandFilePath(safeName, target),
    content: buildCommandMarkdown(workflow, target),
  };
  const agentFiles = collectAgentFiles(workflow.nodes, workflow.edges, target);
  const runScripts = generateRunScriptFiles(safeName, target);
  return [commandFile, ...agentFiles, ...runScripts];
}

export function getCommandMarkdown(workflow: WorkflowJSON): string {
  return buildCommandMarkdown(workflow);
}
