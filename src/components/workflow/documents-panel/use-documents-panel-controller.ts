"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { useLibraryDocsStore } from "@/store/library-docs";
import type { LibraryScope } from "@/types/library";
import type { LibraryDocumentRecord } from "@/lib/library-store/types";

export function useDocumentsPanelController(open: boolean) {
  const store = useLibraryDocsStore(
    useShallow((s) => ({
      workspaceId: s.workspaceId,
      workspacePacks: s.workspacePacks,
      userPacks: s.userPacks,
      selectedPackId: s.selectedPackId,
      documents: s.documents,
      skills: s.skills,
      packVersions: s.packVersions,
      pendingMerges: s.pendingMerges,
      conflicts: s.conflicts,
      loading: s.loading,
      saving: s.saving,
      bootstrap: s.bootstrap,
      selectPack: s.selectPack,
      loadPackDetail: s.loadPackDetail,
      loadDocumentContent: s.loadDocumentContent,
      createPack: s.createPack,
      createDocument: s.createDocument,
      saveDocument: s.saveDocument,
      createSkill: s.createSkill,
      publishPack: s.publishPack,
      publishSkill: s.publishSkill,
      forkPack: s.forkPack,
      mergeBase: s.mergeBase,
      validatePackById: s.validatePackById,
      importArchive: s.importArchive,
    })),
  );
  const [scope, setScope] = useState<LibraryScope>("workspace");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState<string>("");

  const bootstrap = store.bootstrap;
  useEffect(() => {
    if (!open) return;
    void bootstrap();
  }, [open, bootstrap]);

  const packs = scope === "workspace" ? store.workspacePacks : store.userPacks;
  const selectedPack = packs.find((p) => p.id === store.selectedPackId) ?? null;
  const documents = useMemo(
    () => (store.selectedPackId ? store.documents[store.selectedPackId] ?? [] : []),
    [store.selectedPackId, store.documents],
  );
  const skills = store.selectedPackId ? store.skills[store.selectedPackId] ?? [] : [];
  const packVersions = store.selectedPackId ? store.packVersions[store.selectedPackId] ?? [] : [];
  const selectedDocument = documents.find((d) => d.id === selectedDocId) ?? null;

  const selectPack = useCallback(
    async (packId: string) => {
      store.selectPack(packId);
      await store.loadPackDetail(packId);
      setSelectedDocId(null);
    },
    [store],
  );

  const selectDocument = useCallback(
    async (docId: string) => {
      setSelectedDocId(docId);
      const document = documents.find((d) => d.id === docId);
      if (!document || !store.selectedPackId) return;
      const content = await store.loadDocumentContent(store.selectedPackId, docId, document.currentVersionId);
      setDraftContent(content);
    },
    [documents, store],
  );

  const createPack = useCallback(
    async (packKey: string, name: string) => {
      try {
        await store.createPack(scope, packKey, name);
        toast.success(`Pack "${name}" created`);
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [scope, store],
  );

  const createDocument = useCallback(
    async (role: LibraryDocumentRecord["role"], path: string, content: string) => {
      if (!store.selectedPackId) return;
      try {
        await store.createDocument(store.selectedPackId, { role, path, content });
        toast.success(`Document "${path}" created`);
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [store],
  );

  const saveDocument = useCallback(async () => {
    if (!store.selectedPackId || !selectedDocument) return;
    try {
      await store.saveDocument(
        store.selectedPackId,
        selectedDocument.id,
        draftContent,
        selectedDocument.currentVersionId,
      );
      toast.success("Document saved");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [draftContent, selectedDocument, store]);

  const createSkill = useCallback(
    async (skillKey: string, name: string, description: string, entrypointDocId: string) => {
      if (!store.selectedPackId) return;
      try {
        await store.createSkill(store.selectedPackId, { skillKey, name, description, entrypointDocId });
        toast.success(`Skill "${name}" created`);
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [store],
  );

  const publishPack = useCallback(
    async (version: string, notes?: string) => {
      if (!store.selectedPackId) return;
      try {
        await store.publishPack(store.selectedPackId, version, notes);
        toast.success(`Pack version ${version} published`);
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [store],
  );

  const publishSkill = useCallback(
    async (skillId: string, version: string, notes?: string) => {
      if (!store.selectedPackId) return;
      try {
        await store.publishSkill(store.selectedPackId, skillId, version, notes);
        toast.success(`Skill version ${version} published`);
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [store],
  );

  const forkPack = useCallback(
    async (packId: string) => {
      try {
        await store.forkPack(packId, "user");
        toast.success("Pack forked into user-local library");
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [store],
  );

  const mergeBase = useCallback(async () => {
    if (!store.selectedPackId) return;
    try {
      const merge = await store.mergeBase(store.selectedPackId);
      if (merge.status === "clean") toast.success("Merge complete (no conflicts)");
      else toast.warning(`Merge produced ${merge.conflictDocs.length} conflict(s)`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [store]);

  const validatePack = useCallback(async () => {
    if (!store.selectedPackId) return;
    try {
      const warnings = await store.validatePackById(store.selectedPackId);
      if (warnings.length === 0) toast.success("Pack valid");
      else toast.message(`${warnings.length} validation issue(s)`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [store]);

  const importArchive = useCallback(
    async (file: File) => {
      try {
        await store.importArchive(file, scope);
        toast.success("Archive imported");
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [scope, store],
  );

  return {
    scope,
    setScope,
    packs,
    selectedPack,
    documents,
    skills,
    packVersions,
    selectedDocument,
    selectedDocId,
    draftContent,
    setDraftContent,
    loading: store.loading,
    saving: store.saving,
    selectPack,
    selectDocument,
    createPack,
    createDocument,
    saveDocument,
    createSkill,
    publishPack,
    publishSkill,
    forkPack,
    mergeBase,
    validatePack,
    importArchive,
    workspaceId: store.workspaceId,
    pendingMerges: store.pendingMerges,
    conflicts: store.conflicts,
  };
}
