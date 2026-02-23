import { ArrowRightLeft } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import type { SwitchNodeData } from "./types";
export const switchRegistryEntry: NodeRegistryEntry = {
  type: "switch", displayName: "Switch", description: "Multi-way branch",
  icon: ArrowRightLeft, accentColor: "orange", accentHex: "#f97316", category: NodeCategory.ControlFlow,
  defaultData: (): SwitchNodeData => ({ type: "switch", label: "Switch", name: "", switchExpr: "", cases: ["Case 1", "Case 2"] }),
};
export const switchSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  switchExpr: z.string(),
  cases: z.array(z.string()),
});