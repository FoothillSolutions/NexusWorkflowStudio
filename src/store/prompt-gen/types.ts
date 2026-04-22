import type { FormSetValue } from "@/nodes/shared/form-types";
import type { ConnectedNodeContext } from "@/nodes/shared/use-connected-resources";
import { WorkflowNodeType } from "@/types/workflow";

export type PromptGenStatus =
  | "idle"
  | "creating-session"
  | "generating"
  | "streaming"
  | "done"
  | "error";
export type PromptGenView = "closed" | "generate" | "edit";
export type PromptGenMode = "structured" | "freeform";
export type PromptGenNodeType =
  | WorkflowNodeType.Agent
  | WorkflowNodeType.Prompt
  | WorkflowNodeType.Skill
  | WorkflowNodeType.Script
  | WorkflowNodeType.ParallelAgent
  | WorkflowNodeType.Document;

export interface PromptGenTemplateFields {
  title?: string;
  purpose?: string;
  variables?: string;
  instructions?: string;
  relevantFiles?: string;
  codebaseStructure?: string;
  workflow?: string;
  template?: string;
  examples?: string;
}

export interface GeneratePayload {
  fields: PromptGenTemplateFields;
  modelId: string;
  providerId: string;
  mode: "structured" | "freeform";
  freeformDescription?: string;
  connectedResourceNames?: {
    skills: string[];
    docs: string[];
    scripts: string[];
  };
  nodeType?: PromptGenNodeType;
  connectedNodeContext?: ConnectedNodeContext;
}

export interface EditPayload {
  currentPrompt: string;
  editInstruction: string;
  modelId: string;
  providerId: string;
  connectedResourceNames?: {
    skills: string[];
    docs: string[];
    scripts: string[];
  };
  nodeType?: PromptGenNodeType;
  connectedNodeContext?: ConnectedNodeContext;
}

export interface PromptGenState {
  sessionId: string | null;
  status: PromptGenStatus;
  generatedText: string;
  generatedTokens: number;
  error: string | null;
  _abortController: AbortController | null;
  _formSetValue: FormSetValue | null;

  view: PromptGenView;
  mode: PromptGenMode;
  freeformText: string;
  editInstruction: string;
  fields: PromptGenTemplateFields;
  expandedSections: Set<string>;
  targetNodeId: string | null;
  targetNodeType: PromptGenNodeType | null;
  targetField: string;
  targetPrompt: string;
  floating: boolean;
  collapsed: boolean;

  // Diff review dialog state — driven by `openDiffReview` / `closeDiffReview`.
  diffReviewOpen: boolean;

  open: (
    nodeId: string,
    currentPrompt: string,
    view: PromptGenView,
    nodeType?: PromptGenNodeType,
    targetField?: string,
  ) => void;
  close: () => void;
  setView: (view: PromptGenView) => void;
  setMode: (mode: PromptGenMode) => void;
  setFreeformText: (text: string) => void;
  setEditInstruction: (text: string) => void;
  updateField: (key: keyof PromptGenTemplateFields, value: string) => void;
  toggleSection: (key: string) => void;
  undock: () => void;
  dock: () => void;
  toggleCollapsed: () => void;
  setTargetPrompt: (prompt: string) => void;
  registerFormSetValue: (sv: FormSetValue | null) => void;
  applyResult: () => void;
  openDiffReview: () => void;
  closeDiffReview: () => void;
  applyMergedResult: (merged: string) => void;

  ensureSession: () => Promise<string | null>;
  generate: (payload: GeneratePayload) => Promise<void>;
  editWithAi: (payload: EditPayload) => Promise<void>;
  cancel: () => void;
  disposeSession: () => Promise<void>;
  resetState: () => void;
}


