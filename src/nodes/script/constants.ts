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
  aiGenerationPrompt: {
    description: "A Bun-compatible script that attaches to skill nodes as a runnable resource. Script nodes are NOT part of the main workflow execution path — they are attachments/resources for skills.",
    dataTemplate: `{"type":"script","label":"<script-file-name>","name":"<id>","promptText":"<bun-compatible-script-source>","detectedVariables":[]}`,
    edgeRules: `Script nodes connect to skills via: sourceHandle "script-out", targetHandle "scripts". A skill can have MULTIPLE connected scripts.`,
    requiredFields: [
      { field: "type", description: 'Must be "script"' },
      { field: "label", description: "Script filename (e.g. lint-fix.ts)" },
      { field: "name", description: "Must equal the node id" },
      { field: "promptText", description: "Actual runnable Bun-compatible script code, not prose instructions" },
    ],
    optionalFields: [
      { field: "detectedVariables", description: "Array of variable names", default: "[]" },
    ],
    connectionRules: `Script nodes connect ONLY to skill nodes. They are exported as Bun scripts under \`.opencode/skills/<skillName>/scripts/\`. Connected script nodes should contain actual runnable Bun-compatible code.`,
    generationHints: [
      "A script node is NOT part of the main workflow execution path — it is an attachment/resource for the skill, similar to how skills attach to agents.",
      "Prefer JavaScript/TypeScript that Bun can execute directly, and use the script node label as the intended script filename (e.g. `lint-fix.ts`).",
      "Position script attachments to the LEFT of their owning skill and BELOW the skill's bottom edge. If multiple scripts are attached to one skill, stack them vertically under that skill.",
    ],
  },
};

export const scriptSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  promptText: z.string(),
  detectedVariables: z.array(z.string()).optional().default([]),
});

