import { FileCode2 } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NodeSize } from "@/nodes/shared/node-size";
import { NODE_ACCENT } from "@/lib/node-colors";
import { WorkflowNodeType } from "@/types/workflow";
import type { ScriptNodeData } from "./types";

export const scriptRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.Script,
  displayName: "Script",
  description: "A custom script",
  icon: FileCode2,
  accentColor: "sky",
  accentHex: NODE_ACCENT.script,
  category: NodeCategory.Basic,
  size: NodeSize.Large,
  defaultData: (): ScriptNodeData => ({
    type: WorkflowNodeType.Script,
    label: "script.ts",
    name: "",
    promptText: "export async function main() {\n  console.log(\"Hello from Bun\");\n}\n\nawait main();\n",
    detectedVariables: [],
  }),
};

export const scriptSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  promptText: z.string(),
  detectedVariables: z.array(z.string()).optional().default([]),
});

