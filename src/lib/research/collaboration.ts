import * as Y from "yjs";
import type { ResearchSpaceData } from "./types";

export function buildResearchRoomId(workspaceId: string, spaceId: string): string {
  return `nexus-research-${workspaceId}-${spaceId}`;
}

export function writeResearchSpaceToDoc(doc: Y.Doc, space: ResearchSpaceData): void {
  const meta = doc.getMap<unknown>("research-meta");
  const blocks = doc.getMap<unknown>("research-blocks");
  doc.transact(() => {
    meta.set("space", { ...space, blocks: [] });
    blocks.clear();
    for (const block of space.blocks) blocks.set(block.id, block);
  });
}

export function readResearchSpaceFromDoc(doc: Y.Doc, fallback: ResearchSpaceData): ResearchSpaceData {
  const meta = doc.getMap<unknown>("research-meta").get("space");
  const blockMap = doc.getMap<unknown>("research-blocks");
  const base = meta && typeof meta === "object" ? meta as ResearchSpaceData : fallback;
  return { ...base, blocks: Array.from(blockMap.values()) as ResearchSpaceData["blocks"] };
}

export function isResearchDocEmpty(doc: Y.Doc): boolean {
  return doc.getMap("research-blocks").size === 0 && doc.getMap("research-meta").size === 0;
}

export function encodeResearchSnapshot(space: ResearchSpaceData): Uint8Array {
  const doc = new Y.Doc();
  writeResearchSpaceToDoc(doc, space);
  return Y.encodeStateAsUpdate(doc);
}

export function decodeResearchSnapshot(update: Uint8Array, fallback: ResearchSpaceData): ResearchSpaceData {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, update);
  return readResearchSpaceFromDoc(doc, fallback);
}

export function prepareResearchAutosaveSnapshot(space: ResearchSpaceData): ResearchSpaceData {
  return {
    ...space,
    collapsedIds: space.blocks.filter((block) => block.collapsed).map((block) => block.id),
    selectedBlockIds: [],
  };
}
