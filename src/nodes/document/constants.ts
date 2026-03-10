import { FileText } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NodeSize } from "@/nodes/shared/node-size";
import { NODE_ACCENT } from "@/lib/node-colors";
import type { DocumentNodeData } from "./types";

/** lowercase, digits, single hyphens — not leading/trailing */
const DOC_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const documentRegistryEntry: NodeRegistryEntry = {
  type: "document",
  displayName: "Document",
  description: "Attach docs to agents",
  icon: FileText,
  accentColor: "yellow",
  accentHex: NODE_ACCENT.document,
  category: NodeCategory.Basic,
  size: NodeSize.Small,
  defaultData: (): DocumentNodeData => ({
    type: "document",
    label: "Document",
    name: "",
    docName: "",
    contentMode: "inline",
    fileExtension: "md",
    contentText: "",
    linkedFileName: "",
    linkedFileContent: "",
    description: "",
  }),
};

export const documentSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric, hyphens, underscores"),
  label: z.string().min(1, "Label is required"),
  docName: z.string()
    .min(1, "Document name is required")
    .regex(DOC_NAME_REGEX, "Lowercase letters, digits, and single hyphens only (e.g. my-doc-1)"),
  contentMode: z.enum(["inline", "linked"]),
  fileExtension: z.enum(["md", "txt", "json", "yaml"]),
  contentText: z.string().default(""),
  linkedFileName: z.string().default(""),
  linkedFileContent: z.string().default(""),
  description: z.string().default(""),
});

