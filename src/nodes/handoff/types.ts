import { WorkflowNodeType } from "@/types/workflow";

export type HandoffMode = "file" | "context";

export type HandoffPayloadStyle = "structured" | "freeform";

export type HandoffPayloadSection =
  | "summary"
  | "artifacts"
  | "nextSteps"
  | "blockers"
  | "openQuestions"
  | "filePaths"
  | "state"
  | "notes";

export interface HandoffNodeData extends Record<string, unknown> {
  type: WorkflowNodeType.Handoff;
  label: string;
  name: string;
  mode: HandoffMode;
  /** Only used when mode === "file". Blank means "use the node id". */
  fileName: string;
  /** Which payload composition to use. Defaults to "structured". */
  payloadStyle: HandoffPayloadStyle;
  /** Selected payload sections (structured mode). */
  payloadSections: HandoffPayloadSection[];
  /** Freeform payload prompt (freeform mode). */
  payloadPrompt: string;
  /** Freeform extra instructions / notes appended to the payload */
  notes: string;
}
