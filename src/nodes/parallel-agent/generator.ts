import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId, mermaidLabel } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";
import type { ParallelAgentNodeData, ParallelAgentSpawnMode } from "./types";

export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, data: WorkflowNodeData): string {
    const d = data as ParallelAgentNodeData;
    return `    ${mermaidId(nodeId)}["Parallel Agent: ${mermaidLabel(d.label || "Parallel Agent")}"]`;
  },

  getDetailsSection(nodeId: string, data: WorkflowNodeData): string {
    const d = data as ParallelAgentNodeData;
    const mode: ParallelAgentSpawnMode = d.spawnMode ?? "fixed";
    const lines: string[] = [`#### ${mermaidId(nodeId)}(Parallel Agent)`, ""];

    if (d.sharedInstructions?.trim()) {
      lines.push(`**Shared instructions**: ${d.sharedInstructions.trim()}`);
      lines.push("");
    }

    if (mode === "fixed") {
      lines.push("**Parallel branches:**");
      for (let index = 0; index < (d.branches ?? []).length; index++) {
        const branch = d.branches[index];
        const label = branch.label || `Branch ${index + 1}`;
        const spawnCount = Math.max(1, Number(branch.spawnCount ?? 1));
        lines.push(`- **branch-${index}** (${label}) → dispatch the connected agent using the \`Agent\` tool x${spawnCount}`);
        if (branch.instructions?.trim()) {
          lines.push(`  - Notes: ${branch.instructions.trim()}`);
        }
      }

      lines.push("");
      lines.push("**Execution method**: For each branch, dispatch the connected agent using the `Agent` tool the configured number of times; run the branches in parallel. Follow the per-agent dispatch details under `## Agent Node Details`.");
    } else {
      const spawnMin = Math.max(1, Number(d.spawnMin ?? 1));
      const spawnMax = Math.max(spawnMin, Number(d.spawnMax ?? spawnMin));
      const criterion = d.spawnCriterion?.trim() || "<criterion>";
      lines.push("**Spawn mode**: dynamic");
      lines.push(`**Spawn range**: ${spawnMin === spawnMax ? `exactly ${spawnMin} times` : `between ${spawnMin} and ${spawnMax} times`}`);
      lines.push(`**Spawn criterion**: ${criterion}`);
      lines.push("");
      lines.push("**Execution method**: Clone the single connected downstream agent per the spawn range and criterion above, and run all clones in parallel.");
    }

    return lines.join("\n");
  },
};

