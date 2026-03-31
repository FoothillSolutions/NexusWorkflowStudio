import type { WorkflowJSON } from "@/types/workflow";
import { workflowJsonSchema } from "@/lib/workflow-schema";

export function validateWorkflowJson(value: unknown) {
  return workflowJsonSchema.safeParse(value);
}

export function readWorkflowJson(
  value: unknown,
  onInvalid?: (message: string) => void,
): WorkflowJSON | null {
  const result = validateWorkflowJson(value);
  if (!result.success) {
    onInvalid?.(result.error.message);
    return null;
  }

  return result.data as WorkflowJSON;
}

export function parseWorkflowJsonOrThrow(
  value: unknown,
  messagePrefix = "Invalid workflow data",
): WorkflowJSON {
  const result = validateWorkflowJson(value);
  if (!result.success) {
    throw new Error(`${messagePrefix}: ${result.error.message}`);
  }

  return result.data as WorkflowJSON;
}

