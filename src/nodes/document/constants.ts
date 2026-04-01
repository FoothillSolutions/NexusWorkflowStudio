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

