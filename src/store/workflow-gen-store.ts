// ─── Re-export shim ──────────────────────────────────────────────────────────
// The workflow generation store has been refactored into modular files under
// ./workflow-gen/. This file preserves the original import path for consumers.

export { useWorkflowGenStore } from "./workflow-gen/index";
export type { WorkflowGenStatus, WorkflowGenState } from "./workflow-gen/types";
