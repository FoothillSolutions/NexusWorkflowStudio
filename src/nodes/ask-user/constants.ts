import { HelpCircle } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import type { AskUserNodeData } from "./types";

export const askUserRegistryEntry: NodeRegistryEntry = {
  type: "ask-user",
  displayName: "Ask User Question",
  description: "Prompt user for input",
  icon: HelpCircle,
  accentColor: "pink",
  accentHex: "#ec4899",
  category: NodeCategory.ControlFlow,
  defaultData: (): AskUserNodeData => ({
    type: "ask-user",
    label: "Ask User Question",
    name: "",
    questionText: "New Question",
    multipleSelection: false,
    aiSuggestOptions: false,
    options: [
      { label: "Option 1", description: "First Option" },
      { label: "Option 2", description: "Second Option" },
    ],
  }),
};

export const askUserOptionSchema = z.object({
  label: z.string().min(1, "Option label required"),
  description: z.string(),
});

export const askUserSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  questionText: z.string().min(1, "Question is required"),
  multipleSelection: z.boolean(),
  aiSuggestOptions: z.boolean(),
  options: z.array(askUserOptionSchema),
}).refine(
  (data) => data.aiSuggestOptions || data.options.length >= 2,
  { message: "At least 2 options required", path: ["options"] }
);
