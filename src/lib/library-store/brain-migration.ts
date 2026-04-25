import { getBrainStore } from "@/lib/brain/server";
import { getLibraryStore } from "./store";
import type { DocumentRole } from "./types";

export interface MigrateBrainOptions {
  workspaceId: string;
  ownerUserId?: string | null;
  packKey?: string;
  packName?: string;
  createdBy?: string;
}

export async function migrateBrainDocsToUserLibrary(options: MigrateBrainOptions): Promise<{ packId: string; importedCount: number }> {
  const brainDocs = await getBrainStore().listDocs(options.workspaceId);
  const store = getLibraryStore();
  const { user, workspace } = await store.ensureLibraries(options.workspaceId, options.ownerUserId ?? "default-user");
  const targetLib = user ?? workspace;

  const packKey = options.packKey ?? "brain-imported";
  const existingPacks = await store.listPacks(targetLib.id, { includeDeleted: true });
  let key = packKey;
  let suffix = 1;
  while (existingPacks.some((p) => p.packKey === key)) {
    key = `${packKey}-${suffix++}`;
  }

  const pack = await store.createPack(targetLib.id, {
    packKey: key,
    name: options.packName ?? "Brain documents",
    description: "Imported from Brain library",
    tags: ["brain", "migrated"],
    createdBy: options.createdBy ?? "",
    metadata: { source: "brain-migration" },
  });

  let importedCount = 0;
  for (const doc of brainDocs) {
    const role = inferRole(doc.docType);
    const ext = doc.docType === "data" ? ".json" : ".md";
    const sanitizedTitle = doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const path = `${sanitizedTitle || doc.id}${ext}`;
    await store.createDocument(pack.id, {
      role,
      path,
      content: doc.content,
      createdBy: options.createdBy ?? doc.createdBy ?? "",
      message: "brain-migration",
      metadata: { brainDocId: doc.id, docType: doc.docType, tags: doc.tags },
    });
    importedCount++;
  }

  return { packId: pack.id, importedCount };
}

function inferRole(docType: string): DocumentRole {
  switch (docType) {
    case "runbook":
    case "guide":
      return "doc";
    case "summary":
    case "note":
      return "reference";
    case "data":
      return "asset";
    default:
      return "doc";
  }
}
