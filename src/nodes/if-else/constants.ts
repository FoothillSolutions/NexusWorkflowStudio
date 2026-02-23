import { GitFork } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import type { IfElseNodeData } from "./types";
export const ifElseRegistryEntry: NodeRegistryEntry = {
  type: "if-else", displayName: "If / Else", description: "Conditional branch",
  icon: GitFork, accentColor: "amber", accentHex: "#f59e0b", category: NodeCategory.ControlFlow,
  defaultData: (): IfElseNodeData => ({ type: "if-else", label: "If / Else", name: "", expression: "" }),
};
export const ifElseSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  expression: z.string(),
});