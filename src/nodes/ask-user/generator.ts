import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { AskUserNodeData } from "./types";

export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as AskUserNodeData;
    const q = d.questionText;
    const label = q
      ? `AskUserQuestion:<br/>${mermaidLabel(q)}`
      : `AskUserQuestion:<br/>${mermaidLabel(d.label)}`;
    return `    ${mermaidId(nodeId)}{"${label}"}`;
  },

  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as AskUserNodeData;
    const aiSuggested = d.aiSuggestOptions ?? false;
    const multiSelect = d.multipleSelection ?? false;
    const options = d.options ?? [];

    const lines: string[] = [
      `#### ${mermaidId(nodeId)}`,
      "",
      `**Question:** ${d.questionText || "_not set_"}`,
      "",
    ];

    // Case 1: Both off — normal single-select with options
    if (!aiSuggested && !multiSelect) {
      lines.push(
        "**Selection mode:** Single Select (branches based on the selected option)"
      );
      lines.push("");
      lines.push("**Options:**");
      for (const opt of options) {
        lines.push(`- **${opt.label}**: ${opt.description || opt.label}`);
      }
    }

    // Case 2: Multi-select on, AI off
    if (multiSelect && !aiSuggested) {
      lines.push(
        "**Selection mode:** Multi-select enabled (a list of selected options is passed to the next node)"
      );
      lines.push("");
      lines.push("**Options:**");
      for (const opt of options) {
        lines.push(`- **${opt.label}**: ${opt.description || opt.label}`);
      }
    }

    // Case 3: AI on, multi-select off
    if (aiSuggested && !multiSelect) {
      lines.push(
        "**Selection mode:** AI Suggestions (AI generates options dynamically based on context and presents them to the user)"
      );
    }

    // Case 4: Both AI and multi-select on
    if (aiSuggested && multiSelect) {
      lines.push(
        "**Selection mode:** AI Suggestions (AI generates options dynamically based on context and presents them to the user)"
      );
      lines.push("");
      lines.push("**Multi-select:** Enabled (user can select multiple options)");
    }

    return lines.join("\n");
  },
};