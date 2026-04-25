import type {
  LibraryDocumentRecord,
  PackRecord,
  SkillRecord,
} from "./types";
import type { ManifestSchemaV1 } from "./schemas";

export interface BuildManifestInput {
  pack: PackRecord;
  skills: SkillRecord[];
  documents: LibraryDocumentRecord[];
  scope: "workspace" | "user";
  version?: string;
}

export function buildManifest(input: BuildManifestInput): ManifestSchemaV1 {
  const { pack, skills, documents, scope, version } = input;
  const activeDocuments = documents.filter((d) => d.deletedAt === null);
  const activeSkills = skills.filter((s) => s.deletedAt === null);
  const docsByRole = activeDocuments.reduce<Record<string, LibraryDocumentRecord[]>>((acc, d) => {
    (acc[d.role] ??= []).push(d);
    return acc;
  }, {});
  const docById = new Map(activeDocuments.map((d) => [d.id, d]));

  const skillsMap: ManifestSchemaV1["skills"] = {};
  for (const skill of activeSkills) {
    const entrypoint = docById.get(skill.entrypointDocId);
    if (!entrypoint) continue;
    skillsMap[skill.skillKey] = {
      skillId: skill.id,
      skillKey: skill.skillKey,
      name: skill.name,
      description: skill.description,
      entrypoint: entrypoint.path,
      documents: (docsByRole["reference"] ?? []).map((d) => d.path),
      rules: (docsByRole["rule"] ?? []).map((d) => d.path),
    };
  }

  return {
    schemaVersion: 1,
    packId: pack.id,
    packKey: pack.packKey,
    name: pack.name,
    description: pack.description,
    version: version ?? "draft",
    scope,
    skills: skillsMap,
    docs: (docsByRole["doc"] ?? []).map((d) => d.path),
    rules: (docsByRole["rule"] ?? []).map((d) => d.path),
    assets: (docsByRole["asset"] ?? []).map((d) => d.path),
    templates: (docsByRole["template"] ?? []).map((d) => d.path),
    examples: (docsByRole["example"] ?? []).map((d) => d.path),
    external: pack.external,
    basePackId: pack.basePackId,
    createdAt: pack.createdAt,
    updatedAt: pack.updatedAt,
  };
}
