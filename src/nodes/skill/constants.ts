import { Wrench } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import { NODE_ACCENT } from "@/lib/node-colors";
import type { SkillNodeData } from "./types";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const skillRegistryEntry: NodeRegistryEntry = {
  type: "skill", displayName: "Skill", description: "A knowledge unit for subagent",
  icon: Wrench, accentColor: "cyan", accentHex: NODE_ACCENT.skill, category: NodeCategory.Basic,
  defaultData: (): SkillNodeData => ({
    type: "skill", label: "Skill", name: "", skillName: "", projectName: "",
    description: "", promptText: "", detectedVariables: [], metadata: [],
  }),
};

export const skillSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  skillName: z.string(),
  projectName: z.string(),
  description: z.string().default(""),
  promptText: z.string().default(""),
  detectedVariables: z.array(z.string()).default([]),
  metadata: z
    .array(
      z.object({
        key: z.string().refine(
          (v) => v.trim() === "" || SLUG_REGEX.test(v.trim()),
          { message: "Must match [a-z0-9]+(-[a-z0-9]+)*" }
        ),
        value: z.string().refine(
          (v) => v.trim() === "" || SLUG_REGEX.test(v.trim()),
          { message: "Must match [a-z0-9]+(-[a-z0-9]+)*" }
        ),
      })
    )
    .default([]),
});