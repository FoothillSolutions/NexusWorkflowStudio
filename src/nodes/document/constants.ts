import { FileText } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NodeSize } from "@/nodes/shared/node-size";
import { NODE_ACCENT } from "@/lib/node-colors";
import { WorkflowNodeType } from "@/types/workflow";
import type { DocumentNodeData } from "./types";
import { DOC_NAME_REGEX, DOC_SUBFOLDER_REGEX } from "./utils";

export const documentRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.Document,
  displayName: "Document",
  description: "Attach docs to agents",
  icon: FileText,
  accentColor: "yellow",
  accentHex: NODE_ACCENT.document,
  category: NodeCategory.Basic,
  size: NodeSize.Small,
  defaultData: (): DocumentNodeData => ({
    type: WorkflowNodeType.Document,
    label: "Document",
    name: "",
    docName: "",
    docSubfolder: "",
    contentMode: "inline",
    fileExtension: "md",
    contentText: "",
    linkedFileName: null,
    linkedFileContent: null,
    description: "",
  }),
  aiGenerationPrompt: {
    description: "Reference material attached to agents. Provides context, data, or reference content the agent needs. A document node generates a `.opencode/docs/<docName>.<ext>` file, or `.opencode/docs/<docSubfolder>/<docName>.<ext>` when a subfolder is selected.",
    dataTemplate: `{"type":"document","label":"<label>","name":"<id>","docName":"<kebab-case-name>","docSubfolder":"<optional-shared-subfolder>","contentMode":"inline","fileExtension":"md","contentText":"<actual document content - reference material, guides, data>","linkedFileName":"","linkedFileContent":"","description":"<what this document contains>"}`,
    edgeRules: `Documents connect ONLY to agent or parallel-agent nodes via: sourceHandle "doc-out", targetHandle "docs".`,
    requiredFields: [
      { field: "type", description: 'Must be "document"' },
      { field: "label", description: "Human-readable label" },
      { field: "name", description: "Must equal the node id" },
      { field: "docName", description: 'Kebab-case slug used as filename (e.g. "api-guide", "style-rules"). Must match [a-z0-9]+(-[a-z0-9]+)*' },
      { field: "contentMode", description: '"inline" (content typed directly in contentText) or "linked" (external file)' },
      { field: "fileExtension", description: '"md", "txt", "json", or "yaml"' },
      { field: "description", description: "What the document contains" },
    ],
    optionalFields: [
      { field: "docSubfolder", description: 'Optional shared docs subfolder slug (e.g. "product", "team-guides"). Leave empty for docs/ root', default: '""' },
      { field: "contentText", description: "The actual document content when contentMode is inline. Write meaningful reference content.", default: '""' },
      { field: "linkedFileName", description: "Filename when contentMode is linked", default: '""' },
      { field: "linkedFileContent", description: "Content when contentMode is linked", default: '""' },
    ],
    connectionRules: `Documents connect ONLY to agent or parallel-agent nodes via: sourceHandle "doc-out", targetHandle "docs".
An agent or parallel-agent node can have MULTIPLE documents — each provides different reference material. Create a separate document node for each distinct piece of context.
A document node can be connected to MULTIPLE agents simultaneously — the same document provides context to all connected agents. Create one edge per agent it connects to.
A document is NOT part of the main workflow flow — it sits beside its parent agent.`,
    generationHints: [
      "Position document nodes BEHIND (to the LEFT of) their connected agent AND BELOW the agent's bottom edge. Use the same x column as skills: doc_x = agent_x - 180 - 40. doc_y = agent_y + agent_height + 30 (below agent baseline). If an agent has BOTH skills and documents, stack them in the same column behind the agent below the baseline: skills first, documents below, each with 16px vertical gap.",
      "Document contentText should contain actual reference content (not just a placeholder).",
      "When an agent needs reference data, context, or guides, create document nodes with real content and connect them.",
    ],
    examples: [
`Generated document file template (.opencode/docs/<docName>.<ext> or .opencode/docs/<docSubfolder>/<docName>.<ext>):
\`\`\`
<contentText content here - the actual document content>
\`\`\``,
    ],
  },
};

export const documentSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric, hyphens, underscores"),
  label: z.string().min(1, "Label is required"),
  docName: z.string()
    .min(1, "Document name is required")
    .regex(DOC_NAME_REGEX, "Lowercase letters, digits, and single hyphens only (e.g. my-doc-1)"),
  docSubfolder: z.string()
    .default("")
    .refine(
      (value) => value.length === 0 || DOC_SUBFOLDER_REGEX.test(value),
      "Subfolder must use lowercase letters, digits, and single hyphens only",
    ),
  contentMode: z.enum(["inline", "linked"]),
  fileExtension: z.enum(["md", "txt", "json", "yaml"]),
  contentText: z.string().default(""),
  linkedFileName: z.string().nullable().default(null),
  linkedFileContent: z.string().nullable().default(null),
  description: z.string().default(""),
});

