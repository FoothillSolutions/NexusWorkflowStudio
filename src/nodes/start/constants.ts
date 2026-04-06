import { Play } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NODE_ACCENT } from "@/lib/node-colors";
import { WorkflowNodeType } from "@/types/workflow";
import type { StartNodeData } from "./types";

export const startRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.Start,
  displayName: "Start",
  description: "Workflow entry point",
  icon: Play,
  accentColor: "emerald",
  accentHex: NODE_ACCENT.start,
  category: NodeCategory.Basic,
  defaultData: (): StartNodeData => ({
    type: WorkflowNodeType.Start,
    label: "Start",
    name: "",
  }),
  aiGenerationPrompt: {
    description: "Workflow entry point. Every workflow must have exactly ONE start node.",
    dataTemplate: `{"type":"start","label":"Start","name":"<id>"}`,
    requiredFields: [
      { field: "type", description: 'Must be "start"' },
      { field: "label", description: 'Display label, typically "Start"' },
      { field: "name", description: "Must equal the node id" },
    ],
    generationHints: [
      "Start node at x:80, y:300.",
      "Include exactly ONE start node per workflow.",
    ],
  },
};

export const startSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
});
