import { Wrench } from "lucide-react";
import { z } from "zod/v4";
import { NodeCategory } from "@/nodes/shared/registry-types";
import type { NodeRegistryEntry } from "@/nodes/shared/registry-types";
import type { SkillNodeData } from "./types";
export const skillRegistryEntry: NodeRegistryEntry = {
  type: "skill", displayName: "Skill", description: "Execute a skill",
  icon: Wrench, accentColor: "cyan", accentHex: "#06b6d4", category: NodeCategory.Basic,
  defaultData: (): SkillNodeData => ({ type: "skill", label: "Skill", name: "", skillName: "", projectName: "" }),
};
export const skillSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric characters, hyphens, and underscores"),
  label: z.string().min(1, "Label is required"),
  skillName: z.string(), projectName: z.string(),
});