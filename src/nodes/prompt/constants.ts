import { MessageSquareText } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NodeSize } from "@/nodes/shared/node-size";
import { NODE_ACCENT } from "@/lib/node-colors";
import { WorkflowNodeType } from "@/types/workflow";
import type { PromptNodeData } from "./types";
export const promptRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.Prompt,
  displayName: "Prompt",
  description: "Natural language prompt",
  icon: MessageSquareText,
  accentColor: "blue",
  accentHex: NODE_ACCENT.prompt,
  category: NodeCategory.Basic,
  size: NodeSize.Large,
  defaultData: (): PromptNodeData => ({
    type: WorkflowNodeType.Prompt,
    label: "Prompt",
    name: "",
    promptText: "Enter your prompt here.\n\nYou can use variables like {{variableName}}.",
    detectedVariables: [],
  }),
  aiGenerationPrompt: {
    description: "A natural language prompt node for inline text instructions.",
    dataTemplate: `{"type":"prompt","label":"<label>","name":"<id>","promptText":"<text>","detectedVariables":[]}`,
    requiredFields: [
      { field: "type", description: 'Must be "prompt"' },
      { field: "label", description: "Human-readable label" },
      { field: "name", description: "Must equal the node id" },
      { field: "promptText", description: "The prompt text content" },
    ],
    optionalFields: [
      { field: "detectedVariables", description: "Array of variable names referenced in promptText via {{varName}} syntax", default: "[]" },
    ],
  },
};
export const promptSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  promptText: z.string(),
  detectedVariables: z.array(z.string()).optional().default([]),
});
