import { Handshake } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NodeSize } from "@/nodes/shared/node-size";
import { NODE_ACCENT } from "@/lib/node-colors";
import { WorkflowNodeType } from "@/types/workflow";
import type { HandoffNodeData, HandoffPayloadSection } from "./types";

export const HANDOFF_PAYLOAD_SECTIONS: {
  value: HandoffPayloadSection;
  label: string;
  description: string;
}[] = [
  { value: "summary",       label: "Summary",        description: "What was accomplished" },
  { value: "artifacts",     label: "Artifacts",      description: "Files created or modified" },
  { value: "nextSteps",     label: "Next steps",     description: "Remaining work for the downstream agent" },
  { value: "blockers",      label: "Blockers",       description: "Issues that stopped progress" },
  { value: "openQuestions", label: "Open questions", description: "Questions the downstream agent should resolve" },
  { value: "filePaths",     label: "File paths",     description: "Relevant file paths / links" },
  { value: "state",         label: "State snapshot", description: "Current cursor / progress marker" },
  { value: "notes",         label: "Notes",          description: "Freeform additional context" },
];

const PAYLOAD_SECTION_VALUES: [HandoffPayloadSection, ...HandoffPayloadSection[]] = [
  "summary",
  "artifacts",
  "nextSteps",
  "blockers",
  "openQuestions",
  "filePaths",
  "state",
  "notes",
];

/** Permissible characters for the user-provided file name (no slashes, no dots). */
const FILE_NAME_REGEX = /^[a-zA-Z0-9_-]*$/;

export const handoffRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.Handoff,
  displayName: "Handoff",
  description: "Pass context from one agent to another",
  icon: Handshake,
  accentColor: "rose",
  accentHex: NODE_ACCENT.handoff,
  category: NodeCategory.ControlFlow,
  size: NodeSize.Medium,
  defaultData: (): HandoffNodeData => ({
    type: WorkflowNodeType.Handoff,
    label: "Handoff",
    name: "",
    mode: "file",
    fileName: "",
    payloadStyle: "structured",
    payloadSections: ["summary", "artifacts", "nextSteps"],
    payloadPrompt: "",
    notes: "",
  }),
  aiGenerationPrompt: {
    description: `A connector node that formalises agent-to-agent work transfer. Place it between two agent-like nodes so the upstream agent writes a structured Handoff Payload and the downstream agent picks it up. Supports two modes: "file" (upstream writes the payload to a temp file, downstream reads it at startup) and "context" (payload is relayed via the downstream agent's prompt at runtime). Supports two payload styles: "structured" (pick from payloadSections) and "freeform" (provide a payloadPrompt describing what to hand off).`,
    dataTemplate: `{"type":"handoff","label":"<label>","name":"<id>","mode":"file","fileName":"","payloadStyle":"structured","payloadSections":["summary","artifacts","nextSteps"],"payloadPrompt":"","notes":""}

// context + structured variant (no file written):
{"type":"handoff","label":"<label>","name":"<id>","mode":"context","fileName":"","payloadStyle":"structured","payloadSections":["summary","nextSteps"],"payloadPrompt":"","notes":""}

// freeform variant (describe the handoff in prose):
{"type":"handoff","label":"<label>","name":"<id>","mode":"file","fileName":"research-handoff","payloadStyle":"freeform","payloadSections":[],"payloadPrompt":"What research questions were answered, what sources were used, and what's still open.","notes":""}`,
    edgeRules: `Handoff nodes are normal flow nodes. Use sourceHandle "output" and targetHandle "input" for both incoming and outgoing edges — no attachment-style handles. A handoff node accepts incoming flow from agent-like nodes (agent, parallel-agent) and forwards flow to another agent-like node. Skill, document, and script nodes MUST NOT target a handoff node, and a handoff node MUST NOT target a skill, document, or script node.

Example (file-mode handoff between two agents):
  {"id":"e-agent-a-handoff-xy","source":"agent-a","target":"handoff-xy","sourceHandle":"output","targetHandle":"input"}
  {"id":"e-handoff-xy-agent-b","source":"handoff-xy","target":"agent-b","sourceHandle":"output","targetHandle":"input"}`,
    connectionRules: `A handoff node should sit between two agent nodes. The upstream agent is expected to produce the Handoff Payload and the downstream agent is expected to consume it.

MODE CONTRACT:
- "file": the runtime contract is that the upstream agent writes the Handoff Payload to the resolved file path BEFORE finishing, and the downstream agent reads that file at startup BEFORE doing anything else. The resolved path is ALWAYS \`./tmp/handoff-<fileName>.json\` — if \`fileName\` is blank, the handoff node id is used in its place.
- "context": no file is written. The runtime contract is that the upstream agent ends its final response with a "Handoff Payload" section using the configured template, and the orchestrator inlines that section at the top of the downstream agent's prompt. \`fileName\` is unused in context mode.

PAYLOAD STYLE CONTRACT:
- "structured": the upstream agent must emit a bulleted Handoff Payload with one bullet per value in \`payloadSections\`. Use this when the downstream agent benefits from a consistent, predictable shape.
- "freeform": the upstream agent must emit a Handoff Payload whose body follows the free-text instructions in \`payloadPrompt\`. Use this when the handoff is exploratory and doesn't fit the canonical sections. \`payloadSections\` is ignored in freeform mode.

Skills, documents, and scripts cannot connect to or from a handoff node.`,
    requiredFields: [
      { field: "type", description: 'Must be "handoff"' },
      { field: "label", description: "Human-readable label" },
      { field: "name", description: "Must equal the node id" },
      { field: "mode", description: '"file" (write/read temp file) or "context" (inline via prompt relay).' },
      { field: "payloadStyle", description: '"structured" (use payloadSections) or "freeform" (use payloadPrompt).' },
    ],
    optionalFields: [
      { field: "fileName", description: 'File name component used only in file mode. The resolved path is always `./tmp/handoff-<fileName>.json`. Allowed characters: [a-zA-Z0-9_-]. Leave blank to use the handoff node id. Empty string in context mode.', default: '""' },
      { field: "payloadSections", description: 'Required when payloadStyle === "structured". Which payload sections the upstream agent should produce. Values: "summary", "artifacts", "nextSteps", "blockers", "openQuestions", "filePaths", "state", "notes". Ignored in freeform mode.', default: '[]' },
      { field: "payloadPrompt", description: 'Required (non-empty) when payloadStyle === "freeform". Free-text description of what the upstream agent should hand off. Ignored in structured mode.', default: '""' },
      { field: "notes", description: "Freeform additional instructions appended to the Handoff Payload", default: '""' },
    ],
    generationHints: [
      "Prefer placing a handoff between two agent-like nodes — it is not meant to sit next to prompt/script/branching nodes.",
      "In file mode, the resolved path is ALWAYS `./tmp/handoff-<fileName>.json`. Leave `fileName` blank to fall back to the handoff node id; otherwise provide a slug-like name (letters, numbers, hyphens, underscores only — no slashes, no dots).",
      "In context mode, the upstream agent's final response MUST end with a 'Handoff Payload' section — the orchestrator inlines it into the downstream agent's prompt. No temp file is written.",
      "Pick `payloadStyle: \"structured\"` when the downstream agent needs a predictable, bulleted shape — set `payloadSections` accordingly and keep `payloadPrompt` empty.",
      "Pick `payloadStyle: \"freeform\"` when the handoff is exploratory or doesn't fit canonical sections — describe what to hand off in `payloadPrompt` and leave `payloadSections` empty.",
      "Only include the payloadSections that are actually relevant — smaller payloads are easier for the downstream agent to act on.",
      "Skills, documents, and scripts cannot connect to a handoff node — keep attachment nodes wired directly to their agents.",
    ],
    examples: [
`Example (file-mode, structured, between two agents):
{"type":"handoff","label":"Research handoff","name":"handoff-xy","mode":"file","fileName":"","payloadStyle":"structured","payloadSections":["summary","artifacts","nextSteps"],"payloadPrompt":"","notes":""}`,
`Example (context-mode, structured relay):
{"type":"handoff","label":"Inline relay","name":"handoff-ab","mode":"context","fileName":"","payloadStyle":"structured","payloadSections":["summary","nextSteps","openQuestions"],"payloadPrompt":"","notes":"Keep the handoff under 10 bullet points."}`,
`Example (file-mode, freeform, custom file name):
{"type":"handoff","label":"Research handoff","name":"handoff-rs","mode":"file","fileName":"research-handoff","payloadStyle":"freeform","payloadSections":[],"payloadPrompt":"Describe the hypotheses explored, sources cited, and what the next agent should investigate.","notes":""}`,
    ],
  },
};

export const handoffSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  mode: z.enum(["file", "context"]),
  fileName: z
    .string()
    .regex(FILE_NAME_REGEX, "Only letters, numbers, hyphens, and underscores")
    .default(""),
  payloadStyle: z.enum(["structured", "freeform"]).default("structured"),
  payloadSections: z.array(z.enum(PAYLOAD_SECTION_VALUES)).default([]),
  payloadPrompt: z.string().default(""),
  notes: z.string().default(""),
}).superRefine((data, ctx) => {
  if (data.payloadStyle === "freeform" && data.payloadPrompt.trim().length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["payloadPrompt"],
      message: "Describe what should be handed off",
    });
  }
});
