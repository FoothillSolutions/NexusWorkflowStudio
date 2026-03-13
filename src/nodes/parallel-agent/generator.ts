import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { ParallelAgentNodeData } from "./types";

export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as ParallelAgentNodeData;
    return `    ${mermaidId(nodeId)}["Parallel Agent: ${mermaidLabel(d.label || "Parallel Agent")}"]`;
  },

  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as ParallelAgentNodeData;
    const lines: string[] = [`#### ${mermaidId(nodeId)}(Parallel Agent)`, ""];

    if (d.sharedInstructions?.trim()) {
      lines.push(`**Shared instructions**: ${d.sharedInstructions.trim()}`);
      lines.push("");
    }

    lines.push("**Parallel branches:**");
    for (let index = 0; index < (d.branches ?? []).length; index++) {
      const branch = d.branches[index];
      const label = branch.label || `Branch ${index + 1}`;
      const spawnCount = Math.max(1, Number(branch.spawnCount ?? 1));
      lines.push(`- **branch-${index}** (${label}) → spawn the connected agent x${spawnCount}`);
      if (branch.instructions?.trim()) {
        lines.push(`  - Notes: ${branch.instructions.trim()}`);
      }
    }

    lines.push("");
    lines.push("**Execution method**: Spawn the connected downstream agent for each branch handle in parallel using the configured branch counts.");
    return lines.join("\n");
  },
};

