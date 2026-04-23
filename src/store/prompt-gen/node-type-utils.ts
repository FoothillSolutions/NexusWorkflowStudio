import { WorkflowNodeType } from "@/types/workflow";
import type { PromptGenNodeType } from "./types";

export const DEFAULT_PROMPT_GEN_NODE_TYPE = WorkflowNodeType.Agent;

export function getPromptGenNodeLabel(
  nodeType: PromptGenNodeType,
): "agent" | "prompt" | "skill" | "script" | "parallel-agent" | "document" {
  switch (nodeType) {
    case WorkflowNodeType.Skill:
      return "skill";
    case WorkflowNodeType.Prompt:
      return "prompt";
    case WorkflowNodeType.Script:
      return "script";
    case WorkflowNodeType.ParallelAgent:
      return "parallel-agent";
    case WorkflowNodeType.Document:
      return "document";
    default:
      return "agent";
  }
}

export function getPromptGenOutputLabel(nodeType: PromptGenNodeType): string {
  if (nodeType === WorkflowNodeType.Agent) return "prompt";
  if (nodeType === WorkflowNodeType.ParallelAgent) return "shared instructions";
  if (nodeType === WorkflowNodeType.Document) return "document content";
  return getPromptGenNodeLabel(nodeType);
}

