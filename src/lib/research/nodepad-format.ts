import { ResearchSpaceDataSchema } from "./schemas";
import type { ResearchSpaceData } from "./types";

export interface NodepadExport {
  version: "1";
  exportedAt: string;
  projectName: string;
  space: ResearchSpaceData;
}

export function serializeNodepad(space: ResearchSpaceData): string {
  const clean: ResearchSpaceData = {
    ...space,
    blocks: space.blocks.map((block) => ({ ...block })),
    collapsedIds: space.blocks.filter((block) => block.collapsed).map((block) => block.id),
  };
  return JSON.stringify({
    version: "1",
    exportedAt: new Date().toISOString(),
    projectName: space.name,
    space: clean,
  } satisfies NodepadExport, null, 2);
}

function remapDuplicateBlockIds(space: ResearchSpaceData): ResearchSpaceData {
  const seen = new Set<string>();
  const map = new Map<string, string>();
  const blocks = space.blocks.map((block, index) => {
    const nextId = seen.has(block.id) ? `${block.id}-${index + 1}` : block.id;
    seen.add(nextId);
    map.set(block.id, nextId);
    return { ...block, id: nextId };
  });
  return {
    ...space,
    blocks: blocks.map((block) => ({
      ...block,
      influencedByBlockIds: block.influencedByBlockIds.map((id) => map.get(id) ?? id).filter((id) => seen.has(id)),
      mergeWithBlockId: block.mergeWithBlockId ? map.get(block.mergeWithBlockId) ?? null : null,
    })),
    collapsedIds: space.collapsedIds.map((id) => map.get(id) ?? id).filter((id) => seen.has(id)),
  };
}

export function parseNodepad(raw: string, workspaceId: string, newSpaceId: string, name?: string): ResearchSpaceData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Malformed .nodepad file");
  }
  const container = parsed && typeof parsed === "object" ? parsed as Partial<NodepadExport> : {};
  const spaceCandidate = "space" in container ? container.space : parsed;
  const result = ResearchSpaceDataSchema.safeParse(spaceCandidate);
  if (!result.success) throw new Error("Invalid .nodepad research data");
  const now = new Date().toISOString();
  return remapDuplicateBlockIds({
    ...result.data,
    id: newSpaceId,
    workspaceId,
    name: name ?? container.projectName ?? result.data.name,
    createdAt: now,
    updatedAt: now,
  });
}
