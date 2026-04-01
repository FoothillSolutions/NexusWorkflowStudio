import { WorkflowNodeType } from "@/types/workflow";
import type { PromptGenNodeType } from "./types";

export const DEFAULT_PROMPT_GEN_NODE_TYPE = WorkflowNodeType.Agent;

export function getPromptGenNodeLabel(nodeType: PromptGenNodeType): "agent" | "prompt" | "skill" | "script" {
  switch (nodeType) {
    case WorkflowNodeType.Skill:
      return "skill";
    case WorkflowNodeType.Prompt:
      return "prompt";
    case WorkflowNodeType.Script:
      return "script";
    default:
      return "agent";
  }
}

export function getPromptGenOutputLabel(nodeType: PromptGenNodeType): string {
  return nodeType === WorkflowNodeType.Agent ? "prompt" : getPromptGenNodeLabel(nodeType);
}

