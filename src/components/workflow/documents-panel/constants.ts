import { buildWorkflowPanelShellClass, WORKFLOW_PANEL_SURFACE_CLASS } from "../panel-primitives";

export const DOCUMENTS_PANEL_SHELL_CLASS = buildWorkflowPanelShellClass("top-4 right-4");
export const DOCUMENTS_PANEL_SURFACE_CLASS = WORKFLOW_PANEL_SURFACE_CLASS;
export const DOCUMENT_ROLES = [
  "skill-entrypoint",
  "reference",
  "doc",
  "rule",
  "template",
  "example",
  "asset",
  "script",
] as const;
