import { HelpCircle } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NODE_ACCENT } from "@/lib/node-colors";
import { WorkflowNodeType } from "@/types/workflow";
import type { AskUserNodeData } from "./types";

export const askUserRegistryEntry: NodeRegistryEntry = {
  type: WorkflowNodeType.AskUser,
  displayName: "Ask User Question",
  description: "Prompt user for input",
  icon: HelpCircle,
  accentColor: "pink",
  accentHex: NODE_ACCENT["ask-user"],
  category: NodeCategory.ControlFlow,
  defaultData: (): AskUserNodeData => ({
    type: WorkflowNodeType.AskUser,
    label: "Ask User Question",
    name: "",
    questionText: "New Question",
    multipleSelection: false,
    aiSuggestOptions: false,
    options: [
      { label: "Option 1", description: "First Option" },
      { label: "Option 2", description: "Second Option" },
    ],
  }),
  aiGenerationPrompt: {
    description: "Prompt user for input with two different modes that affect output handles.",
    dataTemplate: `{"type":"ask-user","label":"<label>","name":"<id>","questionText":"<question>","multipleSelection":false,"aiSuggestOptions":false,"options":[{"label":"<option1>","description":"<desc1>"},{"label":"<option2>","description":"<desc2>"}]}`,
    edgeRules: `CRITICAL — Ask-user node edges:
Ask-user nodes have TWO different modes that affect their output handles:

MODE 1 — Single-select with manual options (multipleSelection: false AND aiSuggestOptions: false):
- Each option gets its OWN output handle: "option-0", "option-1", "option-2", etc.
- You MUST create one edge per option using "option-N" as the sourceHandle.
- This means the ask-user node IS the branching node — each option branches directly to a different target.
- Do NOT place a \`switch\` or \`if-else\` node immediately after a manual single-select ask-user node just to branch on the selected option. Connect the option edges directly to their downstream targets instead.
- Option targets should be stacked top-to-bottom matching option order (option-0 target = smallest y, last option target = largest y).
- Example: ask-user "ask-user-abc" at y:300 with 3 options:
  {"id":"e-ask-user-abc-agent-a","source":"ask-user-abc","target":"agent-a","sourceHandle":"option-0","targetHandle":"input"}  (agent-a at y:100)
  {"id":"e-ask-user-abc-agent-b","source":"ask-user-abc","target":"agent-b","sourceHandle":"option-1","targetHandle":"input"}  (agent-b at y:300)
  {"id":"e-ask-user-abc-agent-c","source":"ask-user-abc","target":"agent-c","sourceHandle":"option-2","targetHandle":"input"}  (agent-c at y:500)

MODE 2 — Multi-select or AI-suggested options (multipleSelection: true OR aiSuggestOptions: true):
- Uses a SINGLE output handle: "output" (just like a normal node).
- The selected option(s) are passed as text to the next node in the flow.
- Example: {"id":"e-ask-user-abc-agent-x","source":"ask-user-abc","target":"agent-x","sourceHandle":"output","targetHandle":"input"}

DEFAULT: Use MODE 1 (single-select with manual options) unless the user specifically asks for multi-select or AI-generated options. This is the most common and useful pattern because it lets the workflow branch based on the user's choice.`,
    requiredFields: [
      { field: "type", description: 'Must be "ask-user"' },
      { field: "label", description: "Human-readable label" },
      { field: "name", description: "Must equal the node id" },
      { field: "questionText", description: "The question to ask the user" },
      { field: "options", description: "Array of option objects with label and description. At least 2 required." },
    ],
    optionalFields: [
      { field: "multipleSelection", description: "Allow multiple selections", default: "false" },
      { field: "aiSuggestOptions", description: "Let AI suggest options", default: "false" },
    ],
    generationHints: [
      "With multipleSelection:false and aiSuggestOptions:false (the default), each option becomes its own output handle (option-0, option-1, ...). Create one edge per option to branch the flow directly. Do not add a redundant switch or if-else right after this node.",
      "Every ask-user node (in single-select mode) MUST have ALL option handles connected. If you define 3 options, you need 3 outgoing edges.",
      "A manual single-select ask-user node already branches by option. Do not add a switch or if-else immediately after it unless you are branching later on a different piece of logic.",
    ],
  },
};

export const askUserOptionSchema = z.object({
  label: z.string().min(1, "Option label required"),
  description: z.string(),
});

export const askUserSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  questionText: z.string().min(1, "Question is required"),
  multipleSelection: z.boolean(),
  aiSuggestOptions: z.boolean(),
  options: z.array(askUserOptionSchema),
}).refine(
  (data) => data.aiSuggestOptions || data.options.length >= 2,
  { message: "At least 2 options required", path: ["options"] }
);
