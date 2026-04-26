import { create } from "zustand";
import type { ResearchBlock, ResearchSpaceData, ResearchViewMode } from "@/lib/research/types";
import { detectResearchContentType } from "@/lib/research/detect-content-type";

interface ResearchState {
  activeSpace: ResearchSpaceData | null;
  viewMode: ResearchViewMode;
  selectedBlockIds: string[];
  indexOpen: boolean;
  synthesisOpen: boolean;
  aiStatus: "idle" | "running" | "error";
  setActiveSpace: (space: ResearchSpaceData | null) => void;
  setViewMode: (mode: ResearchViewMode) => void;
  addBlock: (content: string) => void;
  updateBlock: (id: string, patch: Partial<ResearchBlock>) => void;
  deleteBlock: (id: string) => void;
  toggleSelected: (id: string) => void;
  setAiStatus: (status: ResearchState["aiStatus"]) => void;
  toggleIndex: () => void;
  toggleSynthesis: () => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newBlock(content: string): ResearchBlock {
  const now = nowIso();
  return {
    id: `block-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    contentType: detectResearchContentType(content),
    category: "Inbox",
    annotation: "AI not connected",
    confidence: 0,
    influencedByBlockIds: [],
    isUnrelated: false,
    mergeWithBlockId: null,
    sources: [],
    tasks: [],
    pinned: false,
    collapsed: false,
    aiError: "AI not connected",
    createdAt: now,
    updatedAt: now,
    createdBy: "browser",
    lastModifiedBy: "browser",
  };
}

export const useResearchStore = create<ResearchState>((set) => ({
  activeSpace: null,
  viewMode: "tiling",
  selectedBlockIds: [],
  indexOpen: true,
  synthesisOpen: false,
  aiStatus: "idle",
  setActiveSpace: (space) => set({ activeSpace: space, viewMode: space?.viewMode ?? "tiling", selectedBlockIds: space?.selectedBlockIds ?? [] }),
  setViewMode: (mode) => set((state) => ({ viewMode: mode, activeSpace: state.activeSpace ? { ...state.activeSpace, viewMode: mode } : null })),
  addBlock: (content) => set((state) => state.activeSpace ? { activeSpace: { ...state.activeSpace, blocks: [...state.activeSpace.blocks, newBlock(content)], updatedAt: nowIso() } } : state),
  updateBlock: (id, patch) => set((state) => state.activeSpace ? { activeSpace: { ...state.activeSpace, blocks: state.activeSpace.blocks.map((block) => block.id === id ? { ...block, ...patch, updatedAt: nowIso(), lastModifiedBy: "browser" } : block), updatedAt: nowIso() } } : state),
  deleteBlock: (id) => set((state) => state.activeSpace ? { activeSpace: { ...state.activeSpace, blocks: state.activeSpace.blocks.filter((block) => block.id !== id), selectedBlockIds: state.activeSpace.selectedBlockIds.filter((item) => item !== id), updatedAt: nowIso() } } : state),
  toggleSelected: (id) => set((state) => {
    const exists = state.selectedBlockIds.includes(id);
    const selectedBlockIds = exists ? state.selectedBlockIds.filter((item) => item !== id) : [...state.selectedBlockIds, id];
    return { selectedBlockIds, activeSpace: state.activeSpace ? { ...state.activeSpace, selectedBlockIds } : null };
  }),
  setAiStatus: (status) => set({ aiStatus: status }),
  toggleIndex: () => set((state) => ({ indexOpen: !state.indexOpen })),
  toggleSynthesis: () => set((state) => ({ synthesisOpen: !state.synthesisOpen })),
}));
