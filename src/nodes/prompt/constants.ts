import { MessageSquareText } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import type { PromptNodeData } from "./types";
export const promptRegistryEntry: NodeRegistryEntry = {
  type: "prompt",
  displayName: "Prompt",
  description: "Natural language prompt",
  icon: MessageSquareText,
  accentColor: "blue",
  accentHex: "#3b82f6",
  category: NodeCategory.Basic,
  defaultData: (): PromptNodeData => ({
    type: "prompt",
    label: "Prompt",
    name: "",
    promptText: "Enter your prompt here.\n\nYou can use variables like {{variableName}}.",
    detectedVariables: [],
  }),
};
export const promptSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  promptText: z.string(),
  detectedVariables: z.array(z.string()).optional().default([]),
});