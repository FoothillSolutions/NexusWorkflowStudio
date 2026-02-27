import { ArrowRightLeft } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NODE_ACCENT } from "@/lib/node-colors";
import type { SwitchNodeData } from "./types";

export const switchRegistryEntry: NodeRegistryEntry = {
  type: "switch",
  displayName: "Switch",
  description: "Multi-way branch",
  icon: ArrowRightLeft,
  accentColor: "orange",
  accentHex: NODE_ACCENT.switch,
  category: NodeCategory.ControlFlow,
  defaultData: (): SwitchNodeData => ({
    type: "switch",
    label: "Switch",
    name: "",
    evaluationTarget: "",
    branches: [
      { label: "Case 1", condition: "" },
      { label: "Case 2", condition: "" },
      { label: "default", condition: "Other cases" },
    ],
  }),
};

export const switchBranchSchema = z.object({
  label: z.string().min(1, "Branch label is required"),
  condition: z.string(),
});

export const switchSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  evaluationTarget: z.string(),
  branches: z.array(switchBranchSchema).min(2, "At least 1 branch plus default are required"),
});