import type { NodeGeneratorModule } from "@/nodes/shared/registry-types";
import { mermaidId } from "@/nodes/shared/mermaid-utils";
import type { WorkflowNodeData } from "@/types/workflow";

export const generator: NodeGeneratorModule = {
  getMermaidShape(nodeId: string, _data: WorkflowNodeData): string {
    return `    ${mermaidId(nodeId)}(["Start"])`;
  },
  getDetailsSection(_nodeId: string, _data: WorkflowNodeData): string {
    return "";
  },
};
