import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { IfElseNodeData } from "./types";

export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as IfElseNodeData;
    const inner = mermaidLabel(d.label || "If/Else");
    return `    ${mermaidId(nodeId)}{If/Else:<br/>${inner}}`;
  },

  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as IfElseNodeData;
    const branches = d.branches ?? [
      { label: "True", condition: "" },
      { label: "False", condition: "" },
    ];

    const lines: string[] = [
      `#### ${mermaidId(nodeId)}(Binary Branch (True/False))`,
      "",
    ];

    if (d.evaluationTarget?.trim()) {
      lines.push(`**Evaluation Target**: ${d.evaluationTarget.trim()}`);
      lines.push("");
    }

    lines.push("**Branch conditions:**");
    for (const branch of branches) {
      const lbl = branch.label || "Unnamed";
      const cond = branch.condition?.trim() || `When ${lbl.toLowerCase()}`;
      lines.push(`- **${lbl}**: ${cond}`);
    }

    lines.push("");
    lines.push(
      "**Execution method**: Evaluate the results of the previous processing and automatically select the appropriate branch based on the conditions above."
    );

    return lines.join("\n");
  },
};