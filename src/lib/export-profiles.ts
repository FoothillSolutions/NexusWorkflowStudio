export type ExportProfileId = "opencode" | "pi-terminal" | "pi-extension";

export interface ExportProfile {
  id: ExportProfileId;
  label: string;
  description: string;
  outputRoot: string;
}

export const EXPORT_PROFILES: ExportProfile[] = [
  {
    id: "opencode",
    label: "OpenCode",
    description: "Generate .opencode command/agent/skill artifacts",
    outputRoot: ".opencode",
  },
  {
    id: "pi-terminal",
    label: "pi terminal",
    description: "Generate .pi prompts/skills artifacts",
    outputRoot: ".pi",
  },
  {
    id: "pi-extension",
    label: "pi extension",
    description: "Generate a deterministic .pi workflow runner extension package",
    outputRoot: ".pi",
  },
];

export function getExportProfile(id: ExportProfileId): ExportProfile {
  return EXPORT_PROFILES.find((p) => p.id === id) ?? EXPORT_PROFILES[0];
}
