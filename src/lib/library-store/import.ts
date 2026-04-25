import JSZip from "jszip";
import { computeContentHash } from "./hashing";
import { getLibraryStore } from "./store";
import type { LibraryScope, PackRecord } from "./types";

export interface ImportNexusInput {
  buffer: Buffer | ArrayBuffer | Uint8Array;
  workspaceId: string;
  ownerUserId?: string | null;
  scope?: LibraryScope;
  createdBy?: string;
}

export interface ImportResult {
  packs: PackRecord[];
}

interface ArchiveManifest {
  schemaVersion: number;
  workflowName: string;
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

export async function importNexusArchive(input: ImportNexusInput): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(input.buffer as Buffer);
  const manifestRaw = await zip.file("manifest.json")?.async("string");
  if (!manifestRaw) throw new Error("Archive missing manifest.json");
  const manifest = JSON.parse(manifestRaw) as ArchiveManifest;

  const hashesRaw = await zip.file("hashes.json")?.async("string");
  if (hashesRaw) {
    const hashes = JSON.parse(hashesRaw) as Record<string, string>;
    for (const [path, expected] of Object.entries(hashes)) {
      const file = zip.file(path);
      if (!file) throw new Error(`Archive missing referenced file ${path}`);
      const content = await file.async("string");
      const actual = computeContentHash(content);
      if (actual !== expected) {
        throw new Error(`Hash mismatch for ${path}`);
      }
    }
  }

  const store = getLibraryStore();
  const { workspace, user } = await store.ensureLibraries(input.workspaceId, input.ownerUserId ?? null);
  const targetLibrary = (input.scope ?? "workspace") === "user" && user ? user : workspace;

  const result: ImportResult = { packs: [] };

  for (const packEntry of manifest.packs) {
    let packKey = packEntry.packKey;
    let suffix = 1;
    const existingKeys = (await store.listPacks(targetLibrary.id, { includeDeleted: true })).map((p) => p.packKey);
    while (existingKeys.includes(packKey)) {
      packKey = `${packEntry.packKey}-imported-${suffix++}`;
    }

    const pack = await store.createPack(targetLibrary.id, {
      packKey,
      name: packEntry.name || packEntry.packKey,
      description: `Imported from ${manifest.workflowName}`,
      tags: [],
      createdBy: input.createdBy ?? "",
      metadata: { external: true, originalPackId: packEntry.packId, originalPackVersion: packEntry.packVersion },
    });

    const skillsForPack = manifest.skills.filter((s) => s.packId === packEntry.packId && s.packVersion === packEntry.packVersion);
    for (const skillEntry of skillsForPack) {
      const skillFolderPrefix = `libraries/${packEntry.scope}/packs/${packEntry.packKey}/skills/${skillEntry.skillKey}/`;
      const entrypointFile = zip.file(`${skillFolderPrefix}SKILL.md`);
      if (!entrypointFile) continue;
      const entrypointContent = await entrypointFile.async("string");

      const { document } = await store.createDocument(pack.id, {
        role: "skill-entrypoint",
        path: "SKILL.md",
        content: entrypointContent,
        createdBy: input.createdBy ?? "",
        message: "import",
      });

      await store.createSkill(pack.id, {
        skillKey: skillEntry.skillKey,
        name: skillEntry.name,
        description: "",
        entrypointDocId: document.id,
        createdBy: input.createdBy ?? "",
      });
    }

    const packPrefix = `libraries/${packEntry.scope}/packs/${packEntry.packKey}/`;
    for (const filename of Object.keys(zip.files)) {
      if (!filename.startsWith(packPrefix)) continue;
      if (filename.endsWith("/")) continue;
      if (filename === `${packPrefix}manifest.json`) continue;
      if (filename.includes("/skills/")) continue;
      const content = await zip.file(filename)!.async("string");
      const relPath = filename.slice(packPrefix.length);
      const role = inferRole(relPath);
      await store.createDocument(pack.id, {
        role,
        path: relPath,
        content,
        createdBy: input.createdBy ?? "",
        message: "import",
      });
    }

    result.packs.push(pack);
  }

  return result;
}

function inferRole(relPath: string): "doc" | "rule" | "asset" | "template" | "example" | "reference" {
  if (relPath.startsWith("rules/")) return "rule";
  if (relPath.startsWith("docs/")) return "doc";
  if (relPath.startsWith("assets/")) return "asset";
  if (relPath.startsWith("templates/")) return "template";
  if (relPath.startsWith("examples/")) return "example";
  if (relPath.startsWith("references/")) return "reference";
  return "doc";
}

export interface ImportAgentSkillsInput {
  buffer: Buffer | ArrayBuffer | Uint8Array;
  workspaceId: string;
  ownerUserId?: string | null;
  scope?: LibraryScope;
  packKey: string;
  packName?: string;
  createdBy?: string;
}

export async function importAgentSkillsFolder(input: ImportAgentSkillsInput): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(input.buffer as Buffer);
  const store = getLibraryStore();
  const { workspace, user } = await store.ensureLibraries(input.workspaceId, input.ownerUserId ?? null);
  const targetLibrary = (input.scope ?? "user") === "user" && user ? user : workspace;

  let packKey = input.packKey;
  const existingKeys = (await store.listPacks(targetLibrary.id, { includeDeleted: true })).map((p) => p.packKey);
  let suffix = 1;
  while (existingKeys.includes(packKey)) {
    packKey = `${input.packKey}-imported-${suffix++}`;
  }
  const pack = await store.createPack(targetLibrary.id, {
    packKey,
    name: input.packName ?? input.packKey,
    description: "",
    tags: [],
    createdBy: input.createdBy ?? "",
    metadata: { external: true },
  });

  const skillFiles = Object.keys(zip.files).filter((f) => f.endsWith("SKILL.md") && !zip.files[f].dir);
  for (const skillFile of skillFiles) {
    const content = await zip.file(skillFile)!.async("string");
    const folder = skillFile.replace(/\/?SKILL\.md$/, "");
    const skillKey = folder.split("/").filter(Boolean).pop() ?? "skill";
    const sanitizedKey = skillKey.toLowerCase().replace(/[^a-z0-9\-]/g, "-").replace(/^-+|-+$/g, "") || "skill";

    const { document } = await store.createDocument(pack.id, {
      role: "skill-entrypoint",
      path: `${sanitizedKey}/SKILL.md`,
      content,
      createdBy: input.createdBy ?? "",
      message: "import-agent-skill",
    });

    await store.createSkill(pack.id, {
      skillKey: sanitizedKey,
      name: sanitizedKey,
      description: "",
      entrypointDocId: document.id,
      createdBy: input.createdBy ?? "",
    });

    const folderPrefix = folder ? `${folder}/` : "";
    for (const otherFile of Object.keys(zip.files)) {
      if (otherFile === skillFile) continue;
      if (folderPrefix && !otherFile.startsWith(folderPrefix)) continue;
      if (zip.files[otherFile].dir) continue;
      const otherContent = await zip.file(otherFile)!.async("string");
      const rel = folderPrefix ? otherFile.slice(folderPrefix.length) : otherFile;
      await store.createDocument(pack.id, {
        role: rel.startsWith("references/") ? "reference" : "doc",
        path: `${sanitizedKey}/${rel}`,
        content: otherContent,
        createdBy: input.createdBy ?? "",
        message: "import-agent-skill",
      });
    }
  }

  return { packs: [pack] };
}
