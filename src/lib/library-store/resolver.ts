import { getLibraryStore } from "./store";
import type { ResolveLiveInput, SkillBundle, SkillBundleDocument } from "./types";

export async function resolveLive(input: ResolveLiveInput): Promise<SkillBundle | null> {
  return getLibraryStore().resolveLive(input);
}

export interface ArtifactResolverData {
  manifest: {
    schemaVersion: number;
    packs: Array<{
      packId: string;
      packKey: string;
      packVersion: string;
      scope: string;
    }>;
  };
  resolverMetadata: Record<string, {
    scope: "workspace" | "user";
    packId: string;
    packKey: string;
    packVersion: string;
    skillId: string;
    skillKey: string;
    skillName: string;
    description: string;
    entrypointPath: string;
    documentPaths: string[];
    manifestHash: string;
  }>;
  files: Map<string, string>;
}

export function resolveFromArtifact(input: ResolveLiveInput, artifact: ArtifactResolverData): SkillBundle | null {
  const key = `${input.scope}:${input.packId}:${input.packVersion}:${input.skillId}`;
  const meta = artifact.resolverMetadata[key];
  if (!meta) return null;
  const entrypointKey = artifactDocumentKey(meta.scope, meta.packKey, meta.skillKey, meta.entrypointPath);
  const entrypointContent = artifact.files.get(entrypointKey);
  if (entrypointContent === undefined) return null;

  const entrypoint: SkillBundleDocument = {
    docId: meta.entrypointPath,
    path: meta.entrypointPath,
    role: "skill-entrypoint",
    content: entrypointContent,
    contentHash: "",
  };
  const documents: SkillBundleDocument[] = [];
  for (const docPath of meta.documentPaths) {
    const fileKey = artifactDocumentKey(meta.scope, meta.packKey, meta.skillKey, docPath);
    const content = artifact.files.get(fileKey);
    if (content === undefined) continue;
    documents.push({
      docId: docPath,
      path: docPath,
      role: "reference",
      content,
      contentHash: "",
    });
  }

  return {
    scope: meta.scope,
    packId: meta.packId,
    packKey: meta.packKey,
    packVersion: meta.packVersion,
    skillId: meta.skillId,
    skillKey: meta.skillKey,
    skillName: meta.skillName,
    description: meta.description,
    entrypoint,
    documents,
    manifestHash: meta.manifestHash,
  };
}

export function artifactDocumentKey(scope: string, packKey: string, skillKey: string, docPath: string): string {
  if (docPath.endsWith("SKILL.md") && !docPath.includes("/")) {
    return `libraries/${scope}/packs/${packKey}/skills/${skillKey}/${docPath}`;
  }
  if (docPath === "SKILL.md") {
    return `libraries/${scope}/packs/${packKey}/skills/${skillKey}/SKILL.md`;
  }
  return `libraries/${scope}/packs/${packKey}/${docPath}`;
}

export function buildResolverKey(scope: string, packId: string, packVersion: string, skillId: string): string {
  return `${scope}:${packId}:${packVersion}:${skillId}`;
}
