import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import { HANDOFF_PAYLOAD_SECTIONS } from "./constants";
import type { HandoffNodeData, HandoffPayloadSection } from "./types";

const SECTION_BULLET: Record<HandoffPayloadSection, { title: string; placeholder: string }> = {
  summary:       { title: "Summary",        placeholder: "<what you accomplished>" },
  artifacts:     { title: "Artifacts",      placeholder: "<files created or modified>" },
  nextSteps:     { title: "Next steps",     placeholder: "<remaining work for the downstream agent>" },
  blockers:      { title: "Blockers",       placeholder: "<issues that stopped progress>" },
  openQuestions: { title: "Open questions", placeholder: "<questions the downstream agent should resolve>" },
  filePaths:     { title: "File paths",     placeholder: "<relevant file paths / links>" },
  state:         { title: "State snapshot", placeholder: "<current cursor / progress marker>" },
  notes:         { title: "Notes",          placeholder: "<freeform additional context>" },
};

/** Ordered list of payload sections that matches the palette ordering. */
const PAYLOAD_ORDER: HandoffPayloadSection[] = HANDOFF_PAYLOAD_SECTIONS.map((s) => s.value);

function orderedSections(selected: HandoffPayloadSection[]): HandoffPayloadSection[] {
  const selectedSet = new Set(selected);
  return PAYLOAD_ORDER.filter((value) => selectedSet.has(value));
}

/** Resolve the handoff's file path from the configured fileName. Blank → use nodeId. */
export function resolveHandoffFilePath(nodeId: string, d: HandoffNodeData): string {
  const name = d.fileName?.trim() || nodeId;
  return `./tmp/handoff-${name}.json`;
}

/**
 * Build the multi-line Handoff Payload template used by the details section and
 * agent-file builder. The returned string is deterministic for a given input.
 */
export function buildHandoffPayloadTemplate(_nodeId: string, d: HandoffNodeData): string {
  const style = d.payloadStyle ?? "structured";
  const notes = d.notes?.trim();

  if (style === "freeform") {
    const body = d.payloadPrompt?.trim() || "<describe what to hand off>";
    const lines: string[] = ["## Handoff Payload", body];
    if (notes) {
      lines.push("");
      lines.push(`Notes: ${notes}`);
    }
    return lines.join("\n");
  }

  const lines: string[] = ["## Handoff Payload"];
  const selected = orderedSections(d.payloadSections ?? []);
  for (const section of selected) {
    const bullet = SECTION_BULLET[section];
    lines.push(`- **${bullet.title}:** ${bullet.placeholder}`);
  }
  if (notes) {
    lines.push("");
    lines.push(`Notes: ${notes}`);
  }
  return lines.join("\n");
}

export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as HandoffNodeData;
    return `    ${mermaidId(nodeId)}["Handoff: ${mermaidLabel(d.label || "Handoff")}"]`;
  },

  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as HandoffNodeData;
    const mode = d.mode ?? "file";
    const style = d.payloadStyle ?? "structured";
    const lines: string[] = [`#### ${mermaidId(nodeId)}(Handoff — ${mode})`, ""];

    if (mode === "file") {
      const resolvedPath = resolveHandoffFilePath(nodeId, d);
      lines.push(`- **Mode:** file`);
      lines.push(`- **File:** \`${resolvedPath}\``);
    } else {
      lines.push(`- **Mode:** context`);
    }

    lines.push(`- **Style:** ${style}`);

    if (style === "structured") {
      const selected = orderedSections(d.payloadSections ?? []);
      if (selected.length > 0) {
        const titles = selected.map((value) => SECTION_BULLET[value].title).join(", ");
        lines.push(`- **Sections:** ${titles}`);
      } else {
        lines.push(`- **Sections:** _none selected_`);
      }
    }

    lines.push("", "**Handoff payload template:**", "```", buildHandoffPayloadTemplate(nodeId, d), "```");

    return lines.join("\n");
  },
};

