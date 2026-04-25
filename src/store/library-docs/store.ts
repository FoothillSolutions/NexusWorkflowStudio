"use client";

import { create } from "zustand";
import {
  createDocument as apiCreateDocument,
  createPack as apiCreatePack,
  createSkill as apiCreateSkill,
  deleteDocument as apiDeleteDocument,
  deleteSkill as apiDeleteSkill,
  exportNexusArchive as apiExport,
  forkPack as apiForkPack,
  getDocumentVersionContent as apiGetVersionContent,
  importNexusArchive as apiImport,
  libraryBootstrap as apiBootstrap,
  listDocuments as apiListDocuments,
  listDocumentVersions as apiListVersions,
  listMergeConflicts as apiListConflicts,
  listPackVersions as apiListPackVersions,
  listPacksForScope as apiListPacks,
  listSkills as apiListSkills,
  listSkillVersions as apiListSkillVersions,
  mergeBaseIntoBranch as apiMergeBase,
  publishPackVersion as apiPublishPack,
  publishSkillVersion as apiPublishSkill,
  resolveLiveSkill as apiResolveLive,
  resolveMergeConflict as apiResolveConflict,
  saveDocumentVersion as apiSaveVersion,
  softDeletePack as apiSoftDeletePack,
  validatePack as apiValidatePack,
} from "@/lib/library-client";
import type {
  ConflictRecord,
  LibraryDocumentRecord,
  LibraryDocumentVersionRecord,
  MergeRecord,
  PackRecord,
  PackVersionRecord,
  SkillRecord,
  SkillVersionRecord,
} from "@/lib/library-store/types";
import type {
  LibraryScope,
  SkillBundle,
  SkillRef,
  ValidationWarning,
} from "@/types/library";

interface LibraryDocsState {
  bootstrapped: boolean;
  workspaceId: string | null;

  workspacePacks: PackRecord[];
  userPacks: PackRecord[];

  selectedPackId: string | null;
  documents: Record<string, LibraryDocumentRecord[]>;
  skills: Record<string, SkillRecord[]>;
  packVersions: Record<string, PackVersionRecord[]>;
  skillVersions: Record<string, SkillVersionRecord[]>;
  documentVersions: Record<string, LibraryDocumentVersionRecord[]>;
  documentContent: Record<string, string>;
  validationWarnings: Record<string, ValidationWarning[]>;
  pendingMerges: Record<string, MergeRecord>;
  conflicts: Record<string, ConflictRecord[]>;

  loading: boolean;
  saving: boolean;
  error: string | null;

  bootstrap: () => Promise<void>;
  refreshPacks: (scope: LibraryScope) => Promise<void>;
  createPack: (scope: LibraryScope, packKey: string, name: string, description?: string) => Promise<PackRecord>;
  forkPack: (packId: string, targetScope?: LibraryScope) => Promise<PackRecord>;
  softDeletePack: (packId: string) => Promise<void>;

  selectPack: (packId: string | null) => void;
  loadPackDetail: (packId: string) => Promise<void>;

  createDocument: (packId: string, payload: { role: LibraryDocumentRecord["role"]; path: string; content: string }) => Promise<LibraryDocumentRecord>;
  saveDocument: (packId: string, docId: string, content: string, previousVersionId: string | null, message?: string) => Promise<LibraryDocumentVersionRecord>;
  deleteDocument: (packId: string, docId: string) => Promise<void>;
  loadDocumentContent: (packId: string, docId: string, versionId: string) => Promise<string>;

  createSkill: (packId: string, payload: { skillKey: string; name: string; description: string; entrypointDocId: string }) => Promise<SkillRecord>;
  deleteSkill: (packId: string, skillId: string) => Promise<void>;

  publishPack: (packId: string, version: string, notes?: string) => Promise<PackVersionRecord>;
  publishSkill: (packId: string, skillId: string, version: string, notes?: string) => Promise<SkillVersionRecord>;

  mergeBase: (packId: string) => Promise<MergeRecord>;
  loadConflicts: (packId: string, mergeId: string) => Promise<ConflictRecord[]>;
  resolveConflict: (packId: string, mergeId: string, resolved: Record<string, string>) => Promise<MergeRecord>;

  validatePackById: (packId: string) => Promise<ValidationWarning[]>;
  resolveLiveSkill: (ref: SkillRef) => Promise<SkillBundle | null>;

  exportArchive: (workflowJson: unknown, workflowName: string) => Promise<Blob>;
  importArchive: (file: File, scope?: LibraryScope) => Promise<PackRecord[]>;
}

export const useLibraryDocsStore = create<LibraryDocsState>((set, get) => ({
  bootstrapped: false,
  workspaceId: null,
  workspacePacks: [],
  userPacks: [],
  selectedPackId: null,
  documents: {},
  skills: {},
  packVersions: {},
  skillVersions: {},
  documentVersions: {},
  documentContent: {},
  validationWarnings: {},
  pendingMerges: {},
  conflicts: {},
  loading: false,
  saving: false,
  error: null,

  bootstrap: async () => {
    if (get().bootstrapped) return;
    set({ loading: true, error: null });
    try {
      const session = await apiBootstrap();
      set({ workspaceId: session.workspaceId, bootstrapped: true });
      await Promise.all([get().refreshPacks("workspace"), get().refreshPacks("user")]);
    } catch (err) {
      set({ error: (err as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  refreshPacks: async (scope) => {
    const packs = await apiListPacks(scope);
    if (scope === "workspace") set({ workspacePacks: packs });
    else set({ userPacks: packs });
  },

  createPack: async (scope, packKey, name, description) => {
    set({ saving: true });
    try {
      const pack = await apiCreatePack(scope, packKey, name, description);
      await get().refreshPacks(scope);
      return pack;
    } finally {
      set({ saving: false });
    }
  },

  forkPack: async (packId, targetScope = "user") => {
    set({ saving: true });
    try {
      const fork = await apiForkPack(packId, targetScope);
      await get().refreshPacks(targetScope);
      return fork;
    } finally {
      set({ saving: false });
    }
  },

  softDeletePack: async (packId) => {
    await apiSoftDeletePack(packId);
    await Promise.all([get().refreshPacks("workspace"), get().refreshPacks("user")]);
  },

  selectPack: (packId) => set({ selectedPackId: packId }),

  loadPackDetail: async (packId) => {
    set({ loading: true });
    try {
      const [documents, skills, packVersions] = await Promise.all([
        apiListDocuments(packId),
        apiListSkills(packId),
        apiListPackVersions(packId),
      ]);
      set((state) => ({
        documents: { ...state.documents, [packId]: documents },
        skills: { ...state.skills, [packId]: skills },
        packVersions: { ...state.packVersions, [packId]: packVersions },
      }));
      const skillVersionsForPack: Record<string, SkillVersionRecord[]> = { ...get().skillVersions };
      for (const skill of skills) {
        skillVersionsForPack[skill.id] = await apiListSkillVersions(packId, skill.id);
      }
      set({ skillVersions: skillVersionsForPack });
    } finally {
      set({ loading: false });
    }
  },

  createDocument: async (packId, payload) => {
    set({ saving: true });
    try {
      const { document } = await apiCreateDocument(packId, payload);
      await get().loadPackDetail(packId);
      return document;
    } finally {
      set({ saving: false });
    }
  },

  saveDocument: async (packId, docId, content, previousVersionId, message) => {
    set({ saving: true });
    try {
      const version = await apiSaveVersion(packId, docId, { content, previousVersionId, message });
      const versions = await apiListVersions(packId, docId);
      set((state) => ({
        documentVersions: { ...state.documentVersions, [docId]: versions },
        documentContent: { ...state.documentContent, [docId]: content },
      }));
      await get().loadPackDetail(packId);
      return version;
    } finally {
      set({ saving: false });
    }
  },

  deleteDocument: async (packId, docId) => {
    await apiDeleteDocument(packId, docId);
    await get().loadPackDetail(packId);
  },

  loadDocumentContent: async (packId, docId, versionId) => {
    const content = await apiGetVersionContent(packId, docId, versionId);
    set((state) => ({ documentContent: { ...state.documentContent, [docId]: content } }));
    return content;
  },

  createSkill: async (packId, payload) => {
    const skill = await apiCreateSkill(packId, payload);
    await get().loadPackDetail(packId);
    return skill;
  },

  deleteSkill: async (packId, skillId) => {
    await apiDeleteSkill(packId, skillId);
    await get().loadPackDetail(packId);
  },

  publishPack: async (packId, version, notes) => {
    const packVersion = await apiPublishPack(packId, { version, notes });
    await get().loadPackDetail(packId);
    return packVersion;
  },

  publishSkill: async (packId, skillId, version, notes) => {
    const skillVersion = await apiPublishSkill(packId, skillId, { version, notes });
    await get().loadPackDetail(packId);
    return skillVersion;
  },

  mergeBase: async (packId) => {
    const merge = await apiMergeBase(packId);
    set((state) => ({ pendingMerges: { ...state.pendingMerges, [packId]: merge } }));
    if (merge.status === "conflict") {
      const conflicts = await apiListConflicts(packId, merge.id);
      set((state) => ({ conflicts: { ...state.conflicts, [merge.id]: conflicts } }));
    }
    await get().loadPackDetail(packId);
    return merge;
  },

  loadConflicts: async (packId, mergeId) => {
    const conflicts = await apiListConflicts(packId, mergeId);
    set((state) => ({ conflicts: { ...state.conflicts, [mergeId]: conflicts } }));
    return conflicts;
  },

  resolveConflict: async (packId, mergeId, resolved) => {
    const merge = await apiResolveConflict(packId, mergeId, { resolvedContentByDocId: resolved });
    set((state) => ({
      pendingMerges: { ...state.pendingMerges, [packId]: merge },
    }));
    await get().loadPackDetail(packId);
    return merge;
  },

  validatePackById: async (packId) => {
    const warnings = await apiValidatePack(packId);
    set((state) => ({ validationWarnings: { ...state.validationWarnings, [packId]: warnings } }));
    return warnings;
  },

  resolveLiveSkill: async (ref) => {
    return apiResolveLive(ref);
  },

  exportArchive: async (workflowJson, workflowName) => {
    return apiExport(workflowJson, workflowName);
  },

  importArchive: async (file, scope = "workspace") => {
    const packs = await apiImport(file, scope);
    await Promise.all([get().refreshPacks("workspace"), get().refreshPacks("user")]);
    return packs;
  },
}));
