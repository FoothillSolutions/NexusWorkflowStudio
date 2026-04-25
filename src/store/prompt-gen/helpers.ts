import type { Part } from "@/lib/opencode";
import type { ConnectedNodeContext, NodeSummary } from "@/nodes/shared/use-connected-resources";
import type {
  EditPayload,
  GeneratePayload,
  PromptGenNodeType,
} from "./types";
import { WorkflowNodeType } from "@/types/workflow";
import {
  DEFAULT_PROMPT_GEN_NODE_TYPE,
  getPromptGenNodeLabel,
  getPromptGenOutputLabel,
} from "./node-type-utils";

/** Build a Markdown snippet listing connected skills, docs, and scripts. */
export function buildConnectedResourcesBlock(
  resources?: { skills: string[]; docs: string[]; scripts: string[] },
): string {
  if (!resources) return "";

  const lines: string[] = [];
  if (resources.skills.length > 0) {
    lines.push("**Connected Skills:**");
    for (const skill of resources.skills) lines.push(`- {{${skill}}}`);
  }
  if (resources.docs.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("**Connected Documents:**");
    for (const doc of resources.docs) lines.push(`- {{${doc}}}`);
  }
  if (resources.scripts.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("**Connected Scripts:**");
    for (const script of resources.scripts) lines.push(`- {{${script}}}`);
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

export function buildConnectedResourceGuidance(
  nodeType: PromptGenNodeType,
  resources?: { skills: string[]; docs: string[]; scripts: string[] },
): string {
  if (!resources) return "";

  const lines: string[] = [];

  if (nodeType === WorkflowNodeType.Agent) {
    if (resources.skills.length > 0) {
      lines.push(
        "- Connected skills are reusable capability modules. Reference them with the exact `{{skill-name}}` syntax and explain when the agent should rely on each skill.",
      );
    }
    if (resources.docs.length > 0) {
      lines.push(
        "- Connected documents are reference sources. Reference them with the exact `{{doc-name.ext}}` or provided `{{name}}` syntax when the agent should consult them.",
      );
    }
  }

  if (nodeType === WorkflowNodeType.Skill && resources.scripts.length > 0) {
    lines.push(
      "- Connected scripts are runnable Bun helpers attached to this skill. Refer to them with the exact `{{script-name}}` syntax when the skill should call or recommend a helper script.",
    );
    lines.push(
      "- Describe what each referenced script is for, when to run it, what inputs it expects, and what output/result the agent should use.",
    );
    lines.push(
      "- Do not inline the full script source into the skill prompt. Treat scripts as external runnable helpers documented by the skill.",
    );
  }

  if (nodeType === WorkflowNodeType.Script) {
    lines.push(
      "- If workflow context shows this script is attached to a skill, write the script as a focused helper that supports that skill's workflow directly.",
    );
    lines.push(
      "- Prefer Bun-compatible TypeScript/JavaScript with a clear entrypoint, explicit inputs, and useful console output or return data.",
    );
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

/** Format a single node summary as a concise Markdown bullet. */
export function formatNodeSummary(node: NodeSummary): string {
  const parts: string[] = [`- **[${node.type}]** "${node.label || node.name}"`];
  if (node.description) parts.push(`  — ${node.description}`);
  if (node.promptText) parts.push(`  Prompt excerpt: ${node.promptText}`);
  if (node.branches && node.branches.length > 0) {
    parts.push(`  Branches: ${node.branches.join("; ")}`);
  }
  return parts.join("\n");
}

/** Build a Markdown snippet describing upstream/downstream workflow neighbours. */
export function buildConnectedNodeContextBlock(
  context?: ConnectedNodeContext,
): string {
  if (!context) return "";

  const { upstream, downstream } = context;
  if (upstream.length === 0 && downstream.length === 0) return "";

  const lines: string[] = [];
  if (upstream.length > 0) {
    lines.push("**Upstream Nodes (execute before this node):**");
    for (const node of upstream) lines.push(formatNodeSummary(node));
  }
  if (downstream.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("**Downstream Nodes (execute after this node):**");
    for (const node of downstream) lines.push(formatNodeSummary(node));
  }

  return lines.join("\n");
}

/** The canonical template that every generated agent prompt should follow. */
export const PROMPT_TEMPLATE = `
### **Title**
\`[Verb] [Object] [Context]\`

### **Purpose**
**What it does:** [1–2 sentences: high-level function]
**Why it exists:** [1 sentence: business/user value]
**Success criteria:** [Bullets: measurable outcomes]

### **Variables**
**Dynamic inputs (positional):** $1, $2, $3 = [meaning]
**Static/config values (named):** {{agent_name}}, {{owner}}, {{default_timezone}}, {{source_system}}
**Derived values (computed by agent):** {{start_date}}, {{end_date}} = [rule to compute]

### **Instructions**
**Primary rules (must follow):** [Non-negotiable rules]
**Constraints (do not do these):** [Forbidden actions]
**Edge cases & handling:** [If X is missing → default behavior, if input is ambiguous → fallback]
**Guardrails (safety/quality):** Validate assumptions, prefer deterministic steps, log decisions.

### **Relevant Files**
**Required inputs:** paths/patterns
**Optional references:** README, examples
**File patterns to search:** globs

### **Codebase Structure**
**Top-level layout:** src/, configs/, docs/, tests/, scripts/
**Where to make changes:** Feature logic, interfaces, shared utilities, tests

### **Workflow**
1. Parse inputs → 2. Validate → 3. Collect dependencies → 4. Process → 5. Verify → 6. Produce output → 7. Finish
**Control-flow branches:** MissingFile, VerificationFailure, NoResults

### **Template**
Standard boilerplate: state what you will do, do it, state what happened, include assumptions.

### **Examples**
Example 1 — Basic usage: input → expected behavior
Example 2 — Missing optional input: input → default fallback
Example 3 — Edge case: invalid input → error + accepted formats
`.trim();

export function buildSystemMessage(nodeType?: PromptGenNodeType): string {
  if (nodeType === WorkflowNodeType.Script) {
    return `You are a Bun script generator. You receive a description of a script node and output only the executable script source code — nothing else.

CRITICAL RULES:
- Your ENTIRE response must be the script source code itself. No preamble, no explanation, no code fences.
- Output runnable JavaScript or TypeScript that Bun can execute directly.
- Prefer clear, production-ready code with sensible imports, async handling, and small comments only when they add real value.
- Use {{variable_name}} for static/config values when the script should reference connected resources by name.
- If the script needs inputs, it may read Bun arguments from process.argv or Bun.argv as appropriate.
- When workflow context shows the script belongs to a skill, make it a purpose-built helper for that skill rather than a generic standalone utility.
- When workflow context is provided, write the script so it fits naturally with the surrounding workflow and skill behavior.`;
  }

  if (nodeType === WorkflowNodeType.Skill) {
    return `You are a skill-prompt generator. A "skill" is a reusable instruction block that teaches an AI agent **how to do something** — like a procedure, technique, coding pattern, or domain-specific method. You receive a description and output **only the skill prompt text** — nothing else.

CRITICAL RULES:
- Your ENTIRE response must be the skill prompt text itself. No preamble, no "Here is the skill:", no explanation, no commentary before or after.
- Output raw Markdown directly. Do NOT wrap the output in a code block.
- Fill in concrete, actionable content — never leave placeholder brackets like [text] in the final output.
- Write the skill as clear, step-by-step instructions that an AI agent can follow.
- Use imperative style: "Do X", "When Y happens, do Z", "Always ensure…"
- Include edge cases, constraints, and quality checks where relevant.
- Use $1, $2, $3 for dynamic positional parameters when the skill takes inputs.
- Use {{variable_name}} for static/config values.
- Structure with sections if the skill is complex, but keep it concise for simple skills.
- Focus on the *how* — the agent already knows *what* to do from its main prompt; the skill teaches the specific technique.
- When connected scripts are provided, reference them using the exact {{script-name}} syntax and explain when/how the agent should run them.
- Treat connected scripts as external Bun helpers; document their usage, expected inputs, and outputs instead of pasting their source code into the skill.
- When workflow context (upstream/downstream nodes) is provided, tailor the skill to fit naturally within the pipeline — consider what data arrives from upstream nodes and what downstream nodes expect.`;
  }

  if (nodeType === WorkflowNodeType.ParallelAgent) {
    return `You are a shared-instructions generator for a parallel-agent node. The parallel-agent spawns multiple downstream agents that all share a common goal. You receive a description of that goal and output **only the shared instruction text** — nothing else.

CRITICAL RULES:
- Your ENTIRE response must be the shared instruction text itself. No preamble, no "Here is:", no explanation, no commentary before or after.
- Output raw Markdown or plain prose directly. Do NOT wrap the output in a code block.
- The instructions are broadcast to every spawned/cloned agent in the parallel group — write for an audience of N agents cooperating on the same task.
- Make the shared goal explicit: what the group is collectively trying to accomplish, how agents should coordinate, and what every agent has in common.
- Call out partitioning, non-overlap, or uniqueness rules when the branches are meant to divide work.
- Fill in concrete, actionable content — never leave placeholder brackets like [text] in the final output.
- Use {{variable_name}} for static/config values when referencing connected skills or documents.
- Keep it focused and imperative: "All agents should…", "Each spawned agent must…", "When producing output…".
- When workflow context (upstream/downstream nodes) is provided, tailor the instructions so the parallel group fits naturally in the pipeline.`;
  }

  if (nodeType === WorkflowNodeType.Document) {
    return `You are a document-content generator for a workflow document node. Document nodes emit a file (Markdown, plain text, JSON, or YAML) that other agents and skills in the workflow consume as reference material. You receive a description of the document and output **only the document body** — nothing else.

CRITICAL RULES:
- Your ENTIRE response must be the document content itself. No preamble, no "Here is the document:", no explanation, no commentary before or after.
- Output raw content directly in the target format. Do NOT wrap Markdown output in a code block.
- Write the document as a durable reference — something an agent or human can consult repeatedly. Use clear headings, sections, and structure as appropriate.
- Fill in concrete, actionable content — never leave placeholder brackets like [text] in the final output.
- If the document is intended as structured data (JSON/YAML), emit valid syntax with realistic example values.
- If the document is Markdown, use semantic headings (##, ###) and concise prose; include tables, lists, or fenced code examples when they clarify the content.
- Use {{variable_name}} for static/config values only when the document template genuinely needs interpolation.
- When workflow context (upstream/downstream nodes) is provided, shape the document so it serves the agents that will read it — include what they need, skip what they don't.`;
  }

  if (nodeType === WorkflowNodeType.Prompt) {
    return `You are a prompt-text generator. You receive a description of a prompt and you output **only the prompt text** — nothing else.

CRITICAL RULES:
- Your ENTIRE response must be the prompt text itself. No preamble, no "Here is the prompt:", no explanation, no plan, no commentary before or after.
- Output raw Markdown directly. Do NOT wrap the output in a code block.
- Fill in concrete, actionable content — never leave placeholder brackets like [text] in the final output.
- Write clear, well-structured prompt text. Use sections, bullet points, and formatting as appropriate for the content.
- Use $1, $2, $3 for dynamic positional parameters when the user mentions inputs
- Use {{variable_name}} for static/config values
- You do NOT need to follow any specific template structure — let the content dictate the format
- Keep the prompt focused, practical, and directly usable
- When workflow context (upstream/downstream nodes) is provided, consider what precedes and follows this prompt in the pipeline and write content that fits naturally in that flow.`;
  }

  return `You are an agent-file prompt generator. You receive a description of an agent and you output **only the raw Markdown content that belongs inside that agent file's body/system prompt** — nothing else.

CRITICAL RULES:
- Your ENTIRE response must be the agent file content itself. No preamble, no "Here is the prompt:", no explanation, no plan, no steps to build anything, no commentary before or after.
- Output only the body content that should live in the agent's Markdown file. Do not add code fences, wrapper prose, notes, suggestions, or extra sections outside the agent content itself.
- Do NOT create a plan. Do NOT describe how to build the agent. Do NOT list implementation steps.
- You are writing THE PROMPT that the agent will receive as its system instructions.
- Keep the result platform-neutral. Do NOT include device-specific commands, OS-specific setup steps, keyboard shortcuts, shell commands, terminal configuration, or machine settings unless the input explicitly requires a concrete environment.
- Output raw Markdown directly. Do NOT wrap the output in a code block.
- Fill in concrete, actionable content — never leave placeholder brackets like [text] in the final output.

Use the following reference template structure. **Every section is optional.** Only include sections that are relevant — skip any that do not add value.

${PROMPT_TEMPLATE}

Style rules:
- Write in a direct, imperative style addressed to the agent (e.g. "You are a…", "Your task is to…")
- Be specific and unambiguous
- Include edge case handling when relevant
- Use $1, $2, $3 for dynamic positional parameters
- Use {{variable_name}} for static/config values
- **Only include sections that are needed** — a simple agent may only need Title, Purpose, and Instructions
- When the user provides connected skills or documents, reference them using the exact {{name}} syntax as given
- When connected skills are provided, explain when the agent should use each skill and what kind of work each skill owns
- When workflow context (upstream/downstream nodes) is provided, consider the agent's role in the pipeline — what it receives from upstream and what downstream nodes expect from it. Tailor instructions, edge cases, and workflow steps accordingly.`;
}

export function buildGenerateUserMessage(payload: GeneratePayload): string {
  const nodeType = payload.nodeType ?? DEFAULT_PROMPT_GEN_NODE_TYPE;
  const sections: string[] = [];
  const fields = payload.fields;

  if (fields.title?.trim()) sections.push(`## Title\n${fields.title.trim()}`);
  if (fields.purpose?.trim()) sections.push(`## Purpose\n${fields.purpose.trim()}`);
  if (fields.variables?.trim()) sections.push(`## Variables\n${fields.variables.trim()}`);
  if (fields.instructions?.trim()) sections.push(`## Instructions\n${fields.instructions.trim()}`);
  if (fields.relevantFiles?.trim()) sections.push(`## Relevant Files\n${fields.relevantFiles.trim()}`);
  if (fields.codebaseStructure?.trim()) sections.push(`## Codebase Structure\n${fields.codebaseStructure.trim()}`);
  if (fields.workflow?.trim()) sections.push(`## Workflow\n${fields.workflow.trim()}`);
  if (fields.template?.trim()) sections.push(`## Template\n${fields.template.trim()}`);
  if (fields.examples?.trim()) sections.push(`## Examples\n${fields.examples.trim()}`);

  const hasFields = sections.length > 0;
  const hasFreeform =
    payload.mode === "freeform" && payload.freeformDescription?.trim();

  const resourceBlock = buildConnectedResourcesBlock(payload.connectedResourceNames);
  const resourceGuidance = buildConnectedResourceGuidance(
    nodeType,
    payload.connectedResourceNames,
  );
  const nodeLabel = getPromptGenNodeLabel(nodeType);
  const resourceSection = resourceBlock
    ? `\n\n## Connected Resources\nThe ${nodeLabel} has the following connected resources. Reference them in the prompt using the exact {{name}} syntax shown below:\n\n${resourceBlock}${resourceGuidance ? `\n\n## Resource Guidance\n${resourceGuidance}` : ""}`
    : "";

  const contextBlock = buildConnectedNodeContextBlock(payload.connectedNodeContext);
  const contextSection = contextBlock
    ? `\n\n## Workflow Context\nThis ${nodeLabel} is part of a larger workflow. Here are the nodes connected before and after it — consider its role in this pipeline:\n\n${contextBlock}`
    : "";

  if (nodeType === WorkflowNodeType.Skill) {
    if (hasFreeform && hasFields) {
      return `Write the skill prompt text for a skill described as:\n${payload.freeformDescription!.trim()}\n\nAdditional details:\n\n${sections.join("\n\n")}${resourceSection}${contextSection}\n\nRemember: output ONLY the skill prompt text — step-by-step instructions that teach an AI agent how to perform this skill. No plan, no explanation.`;
    }

    if (hasFreeform) {
      return `Write the skill prompt text for a skill described as:\n${payload.freeformDescription!.trim()}${resourceSection}${contextSection}\n\nOutput ONLY the skill prompt text. Write clear, actionable instructions that teach an AI agent how to perform this technique or procedure. Use steps, rules, and examples as appropriate.`;
    }

    if (hasFields) {
      return `Write the skill prompt text using these details:\n\n${sections.join("\n\n")}${resourceSection}${contextSection}\n\nYou may add additional content only if clearly inferred from the input. Output ONLY the skill prompt text.`;
    }

    return `Write a well-structured skill prompt that teaches an AI agent a useful technique or procedure. Fill in realistic, actionable content. Output ONLY the skill prompt text.${resourceSection}${contextSection}`;
  }

  if (nodeType === WorkflowNodeType.Script) {
    if (hasFreeform && hasFields) {
      return `Write the Bun script source code for a script described as:\n${payload.freeformDescription!.trim()}\n\nAdditional details:\n\n${sections.join("\n\n")}${resourceSection}${contextSection}\n\nRemember: output ONLY the script source code. No explanation.`;
    }

    if (hasFreeform) {
      return `Write Bun-compatible script source code based on this description:\n${payload.freeformDescription!.trim()}${resourceSection}${contextSection}\n\nOutput ONLY the script source code. No explanation.`;
    }

    if (hasFields) {
      return `Write Bun-compatible script source code using these details:\n\n${sections.join("\n\n")}${resourceSection}${contextSection}\n\nOutput ONLY the script source code.`;
    }

    return `Write a useful Bun-compatible script template with realistic runnable code. Output ONLY the script source code.${resourceSection}${contextSection}`;
  }

  if (nodeType === WorkflowNodeType.ParallelAgent) {
    if (hasFreeform && hasFields) {
      return `Write the shared instruction text for a parallel-agent group described as:\n${payload.freeformDescription!.trim()}\n\nAdditional details:\n\n${sections.join("\n\n")}${resourceSection}${contextSection}\n\nRemember: output ONLY the shared instruction text — no plan, no explanation. Write for every spawned agent in the group.`;
    }
    if (hasFreeform) {
      return `Write the shared instruction text for a parallel-agent group described as:\n${payload.freeformDescription!.trim()}${resourceSection}${contextSection}\n\nOutput ONLY the shared instruction text. Make the group goal, coordination rules, and what each spawned agent must do explicit.`;
    }
    if (hasFields) {
      return `Write the shared instruction text for a parallel-agent group using these details:\n\n${sections.join("\n\n")}${resourceSection}${contextSection}\n\nOutput ONLY the shared instruction text. Address every spawned agent in the group.`;
    }
    return `Write concise, well-structured shared instructions for a parallel-agent group that cooperates on a common task. Make the shared goal, coordination rules, and per-agent expectations explicit. Output ONLY the shared instruction text.${resourceSection}${contextSection}`;
  }

  if (nodeType === WorkflowNodeType.Document) {
    if (hasFreeform && hasFields) {
      return `Write the document body for a workflow document described as:\n${payload.freeformDescription!.trim()}\n\nAdditional details:\n\n${sections.join("\n\n")}${resourceSection}${contextSection}\n\nRemember: output ONLY the document body. Use the appropriate format (Markdown, plain text, JSON, or YAML) and no wrapper text.`;
    }
    if (hasFreeform) {
      return `Write the document body for a workflow document described as:\n${payload.freeformDescription!.trim()}${resourceSection}${contextSection}\n\nOutput ONLY the document body. Structure it as a durable reference that agents or humans will consult repeatedly.`;
    }
    if (hasFields) {
      return `Write the document body using these details:\n\n${sections.join("\n\n")}${resourceSection}${contextSection}\n\nOutput ONLY the document body. No wrapper text.`;
    }
    return `Write a well-structured document body that can serve as reference material inside a workflow. Fill in realistic, concrete content. Output ONLY the document body.${resourceSection}${contextSection}`;
  }

  if (nodeType === WorkflowNodeType.Prompt) {
    if (hasFreeform && hasFields) {
      return `Write prompt text based on this description:\n${payload.freeformDescription!.trim()}\n\nAdditional details:\n\n${sections.join("\n\n")}${resourceSection}${contextSection}\n\nRemember: output ONLY the prompt text. No plan, no explanation. Structure the output naturally based on the content — no need to follow a rigid template.`;
    }

    if (hasFreeform) {
      return `Write prompt text based on this description:\n${payload.freeformDescription!.trim()}${resourceSection}${contextSection}\n\nOutput ONLY the prompt text. Structure it naturally — use sections, bullets, or plain prose as appropriate for the content. Do not follow a rigid template.`;
    }

    if (hasFields) {
      return `Write prompt text using these details:\n\n${sections.join("\n\n")}${resourceSection}${contextSection}\n\nYou may add additional content only if clearly inferred from the input. Output ONLY the prompt text.`;
    }

    return `Write a well-structured, general-purpose prompt template. Fill each section with realistic content that demonstrates good prompt writing. Output ONLY the prompt text.${resourceSection}${contextSection}`;
  }

  if (hasFreeform && hasFields) {
    return `Write only the Markdown body content for the agent file for an agent described as:\n${payload.freeformDescription!.trim()}\n\nAdditional details for the template sections:\n\n${sections.join("\n\n")}${resourceSection}${contextSection}\n\nRemember: output ONLY the agent file content itself. No plan, no explanation, no suggestions, and no wrapper text. Keep it platform-neutral with no device-specific commands or settings unless explicitly required by the input.`;
  }

  if (hasFreeform) {
    return `Write only the Markdown body content for the agent file for an agent described as:\n${payload.freeformDescription!.trim()}${resourceSection}${contextSection}\n\nInfer which template sections are relevant and fill only those with concrete content. Skip sections that don't apply. Output ONLY the agent file content itself, with no wrapper text, suggestions, or device-specific commands/settings.`;
  }

  if (hasFields) {
    return `Write only the Markdown body content for the agent file using these details:\n\n${sections.join("\n\n")}${resourceSection}${contextSection}\n\nYou may add other template sections only if clearly inferred from the input. Output ONLY the agent file content itself, with no wrapper text, suggestions, or device-specific commands/settings.`;
  }

  return `Write a general-purpose agent file body template following the template structure. Fill each section with realistic content that demonstrates how the template should be used. Output ONLY the agent file content itself, with no wrapper text, suggestions, or device-specific commands/settings.${resourceSection}${contextSection}`;
}

export function buildEditUserMessage(payload: EditPayload): string {
  const nodeType = payload.nodeType ?? DEFAULT_PROMPT_GEN_NODE_TYPE;
  const nodeLabel =
    nodeType === WorkflowNodeType.Agent
      ? "agent prompt"
      : nodeType === WorkflowNodeType.ParallelAgent
        ? "parallel-agent shared instructions"
        : nodeType === WorkflowNodeType.Document
          ? "document content"
          : getPromptGenNodeLabel(nodeType);
  const outputInstruction = nodeType === WorkflowNodeType.Agent
    ? "Keep the same template structure. Output ONLY the modified agent file content itself — no explanation, no commentary, no wrapper text, and no device-specific commands/settings unless explicitly required by the edit instruction."
    : `Keep a clear structure. Output ONLY the modified ${getPromptGenOutputLabel(nodeType)} text — no explanation, no commentary.`;
  const resourceBlock = buildConnectedResourcesBlock(
    payload.connectedResourceNames,
  );
  const resourceGuidance = buildConnectedResourceGuidance(
    nodeType,
    payload.connectedResourceNames,
  );
  const resourceSection = resourceBlock
    ? `\n\nThe ${getPromptGenNodeLabel(nodeType)} has the following connected resources — reference them using the exact {{name}} syntax:\n\n${resourceBlock}${resourceGuidance ? `\n\nResource guidance:\n${resourceGuidance}` : ""}`
    : "";

  const contextBlock = buildConnectedNodeContextBlock(payload.connectedNodeContext);
  const contextSection = contextBlock
    ? `\n\nThis ${getPromptGenNodeLabel(nodeType)} is part of a larger workflow. Here are the nodes that execute before and after it — consider its role in the pipeline when making edits:\n\n${contextBlock}`
    : "";

  return `Here is the current ${nodeLabel}:\n\n---\n${payload.currentPrompt}\n---\n\nModify this ${getPromptGenOutputLabel(nodeType)} according to the following instruction:\n${payload.editInstruction}${resourceSection}${contextSection}\n\n${outputInstruction}`;
}

/** Extract text from assistant message parts. */
export function extractTextFromParts(parts: Part[]): string {
  return parts
    .filter((part): part is Extract<Part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/** Rough token estimate (~4 chars per token for English text). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}


