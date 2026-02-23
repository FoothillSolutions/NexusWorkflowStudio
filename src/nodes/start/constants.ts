import { Play } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import type { StartNodeData } from "./types";

export const startRegistryEntry: NodeRegistryEntry = {
  type: "start",
  displayName: "Start",
  description: "Workflow entry point",
  icon: Play,
  accentColor: "emerald",
  accentHex: "#10b981",
  category: NodeCategory.Basic,
  defaultData: (): StartNodeData => ({
    type: "start",
    label: "Start",
    name: "",
  }),
};

export const startSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
});

