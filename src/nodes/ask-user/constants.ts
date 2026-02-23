import { HelpCircle } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import type { AskUserNodeData } from "./types";
export const askUserRegistryEntry: NodeRegistryEntry = {
  type: "ask-user", displayName: "Ask User Question", description: "Prompt user for input",
  icon: HelpCircle, accentColor: "pink", accentHex: "#ec4899", category: NodeCategory.ControlFlow,
  defaultData: (): AskUserNodeData => ({ type: "ask-user", label: "Ask User", name: "", questionText: "", options: ["Option 1", "Option 2"] }),
};
export const askUserSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  questionText: z.string(),
  options: z.array(z.string().min(1, "Option text required")),
});