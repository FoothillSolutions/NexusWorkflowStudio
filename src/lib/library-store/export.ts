import JSZip from "jszip";
import { customAlphabet } from "nanoid";
import { getLibraryStore } from "./store";
import { computeContentHash } from "./hashing";
import { artifactDocumentKey, buildResolverKey } from "./resolver";
import type { SkillBundle } from "./types";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

export interface NexusArchiveManifest {
  schemaVersion: 1;
  workflowName: string;
  createdAt: string;
  createdBy: string;
  resolverMode: "artifact";
  packs: Array<{
    packId: string;
    packKey: string;
    packVersion: string;
    scope: "workspace" | "user";
    name: string;
    skillIds: string[];
  }>;
  skills: Array<{
    skillId: string;
    skillKey: string;
    name: string;
    packId: string;
    packVersion: string;
    scope: "workspace" | "user";
  }>;
}

export interface BuildArchiveInput {
  workflowJson: unknown;
  workflowName: string;
  createdBy?: string;
}

interface ResolvedRef {
  scope: "workspace" | "user";
  packId: string;
  packVersion: string;
  skillId: string;
}

function collectSkillRefs(workflowJson: unknown): ResolvedRef[] {
  if (!workflowJson || typeof workflowJson !== "object") return [];
  const refs: ResolvedRef[] = [];
  const seen = new Set<string>();

  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      for (const v of value) visit(v);
      return;
    }
    if (!value || typeof value !== "object") return;
    const obj = value as Record<string, unknown>;
    if (
      obj.libraryRef &&
      typeof obj.libraryRef === "object" &&
      obj.libraryRef !== null
    ) {
      const ref = obj.libraryRef as Record<string, unknown>;
      if (
        typeof ref.scope === "string" &&
        typeof ref.packId === "string" &&
        typeof ref.packVersion === "string" &&
        typeof ref.skillId === "string" &&
        (ref.scope === "workspace" || ref.scope === "user")
      ) {
        const key = `${ref.scope}:${ref.packId}:${ref.packVersion}:${ref.skillId}`;
        if (!seen.has(key)) {
          seen.add(key);
          refs.push({
            scope: ref.scope as "workspace" | "user",
            packId: ref.packId,
            packVersion: ref.packVersion,
            skillId: ref.skillId,
          });
        }
      }
    }
    for (const v of Object.values(obj)) visit(v);
  }

  visit(workflowJson);
  return refs;
}

export async function buildNexusArchive(input: BuildArchiveInput): Promise<{ buffer: Buffer; archiveName: string }> {
  const store = getLibraryStore();
  const refs = collectSkillRefs(input.workflowJson);
  const bundles: SkillBundle[] = [];
  for (const ref of refs) {
    const bundle = await store.resolveLive(ref);
    if (bundle) bundles.push(bundle);
  }

  const zip = new JSZip();
  const hashes: Record<string, string> = {};
  const resolverMetadata: Record<string, ReturnType<typeof buildResolverEntry>> = {};
  const fileContents = new Map<string, string>();

  const workflowJsonText = JSON.stringify(input.workflowJson, null, 2);
  zip.file("workflow.json", workflowJsonText);
  hashes["workflow.json"] = computeContentHash(workflowJsonText);
  fileContents.set("workflow.json", workflowJsonText);

  const archiveManifest: NexusArchiveManifest = {
    schemaVersion: 1,
    workflowName: input.workflowName,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy ?? "",
    resolverMode: "artifact",
    packs: [],
    skills: [],
  };

  const packAdded = new Set<string>();
  for (const bundle of bundles) {
    const packKey = `${bundle.scope}:${bundle.packId}:${bundle.packVersion}`;
    if (!packAdded.has(packKey)) {
      packAdded.add(packKey);
      archiveManifest.packs.push({
        packId: bundle.packId,
        packKey: bundle.packKey,
        packVersion: bundle.packVersion,
        scope: bundle.scope,
        name: bundle.skillName,
        skillIds: [],
      });
      const packManifestPath = `libraries/${bundle.scope}/packs/${bundle.packKey}/manifest.json`;
      const packManifest = {
        schemaVersion: 1,
        packId: bundle.packId,
        packKey: bundle.packKey,
        version: bundle.packVersion,
        scope: bundle.scope,
      };
      const packManifestText = JSON.stringify(packManifest, null, 2);
      zip.file(packManifestPath, packManifestText);
      hashes[packManifestPath] = computeContentHash(packManifestText);
      fileContents.set(packManifestPath, packManifestText);
    }

    archiveManifest.packs.find((p) => p.packId === bundle.packId && p.packVersion === bundle.packVersion)?.skillIds.push(bundle.skillId);
    archiveManifest.skills.push({
      skillId: bundle.skillId,
      skillKey: bundle.skillKey,
      name: bundle.skillName,
      packId: bundle.packId,
      packVersion: bundle.packVersion,
      scope: bundle.scope,
    });

    const entrypointPath = artifactDocumentKey(bundle.scope, bundle.packKey, bundle.skillKey, "SKILL.md");
    zip.file(entrypointPath, bundle.entrypoint.content);
    hashes[entrypointPath] = computeContentHash(bundle.entrypoint.content);
    fileContents.set(entrypointPath, bundle.entrypoint.content);

    const documentPaths: string[] = [];
    for (const doc of bundle.documents) {
      const docKey = artifactDocumentKey(bundle.scope, bundle.packKey, bundle.skillKey, doc.path);
      zip.file(docKey, doc.content);
      hashes[docKey] = computeContentHash(doc.content);
      fileContents.set(docKey, doc.content);
      documentPaths.push(doc.path);
    }

    resolverMetadata[buildResolverKey(bundle.scope, bundle.packId, bundle.packVersion, bundle.skillId)] = buildResolverEntry(bundle, documentPaths);
  }

  const manifestText = JSON.stringify(archiveManifest, null, 2);
  zip.file("manifest.json", manifestText);
  hashes["manifest.json"] = computeContentHash(manifestText);

  const resolverText = JSON.stringify({ schemaVersion: 1, entries: resolverMetadata }, null, 2);
  zip.file("runtime/resolver-metadata.json", resolverText);
  hashes["runtime/resolver-metadata.json"] = computeContentHash(resolverText);

  const hashesText = JSON.stringify(hashes, null, 2);
  zip.file("hashes.json", hashesText);

  for (const [path, expected] of Object.entries(hashes)) {
    if (path === "hashes.json") continue;
    const actual = fileContents.has(path)
      ? computeContentHash(fileContents.get(path)!)
      : expected;
    if (actual !== expected) {
      throw new Error(`Integrity check failed for ${path}`);
    }
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const archiveName = input.workflowName.replace(/[^a-zA-Z0-9_\-]/g, "-").toLowerCase() || "workflow";
  return { buffer, archiveName: `${archiveName}-${nanoid()}.nexus` };
}

function buildResolverEntry(bundle: SkillBundle, documentPaths: string[]) {
  return {
    scope: bundle.scope,
    packId: bundle.packId,
    packKey: bundle.packKey,
    packVersion: bundle.packVersion,
    skillId: bundle.skillId,
    skillKey: bundle.skillKey,
    skillName: bundle.skillName,
    description: bundle.description,
    entrypointPath: "SKILL.md",
    documentPaths,
    manifestHash: bundle.manifestHash,
  };
}
