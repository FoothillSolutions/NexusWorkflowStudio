import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { SwitchNodeData } from "./types";

export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SwitchNodeData;
    const inner = mermaidLabel(d.label || "Switch");
    return `    ${mermaidId(nodeId)}{Switch:<br/>${inner}}`;
  },

  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as SwitchNodeData;
    const branches = d.branches ?? [];

    const lines: string[] = [
      `#### ${mermaidId(nodeId)}(Multiple Branch (2-N))`,
      "",
    ];

    if (d.evaluationTarget?.trim()) {
      lines.push(`**Evaluation Target**: ${d.evaluationTarget.trim()}`);
      lines.push("");
    }

    lines.push("**Branch conditions:**");
    for (const branch of branches) {
      if (branch.label === "default") {
        lines.push(`- **default**: Other cases`);
      } else {
        const lbl = branch.label || "Unnamed";
        const cond = branch.condition?.trim() || `When ${lbl.toLowerCase()} is met`;
        lines.push(`- **${lbl}**: ${cond}`);
      }
    }

    lines.push("");
    lines.push(
      "**Execution method**: Evaluate the results of the previous processing and automatically select the appropriate branch based on the conditions above."
    );

    return lines.join("\n");
  },
};