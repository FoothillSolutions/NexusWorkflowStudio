"use client";

import { useCallback, useEffect, useState } from "react";
import { exportWorkflow } from "@/lib/persistence";
import { getCommandMarkdown } from "@/lib/workflow-generator";
import {
  DEFAULT_GENERATION_TARGET,
  type GenerationTargetId,
} from "@/lib/generation-targets";
import { useSavedWorkflowsStore } from "@/store/library";
import { useOpenCodeStore } from "@/store/opencode";
import { useWorkflowGenStore } from "@/store/workflow-gen";
import { useSidekickStore } from "@/store/sidekick";
import { useWorkflowStore } from "@/store/workflow";
import { useCollabStore, createRoomId } from "@/store/collaboration";
import { buildCollabRoomUrl, buildCollabShareUrl, CollabDoc } from "@/lib/collaboration";
import { toast } from "sonner";
import type { WorkflowJSON } from "@/types/workflow";

interface HeaderController {
  name: string;
  setName: (name: string) => void;
  isDirty: boolean;
  needsSave: boolean;
  activeWorkflowId: string | null;
  getWorkflowJSON: () => WorkflowJSON;
  isOpenCodeConnected: boolean;
  isWorkflowGenOpen: boolean;
  isSidekickOpen: boolean;
  importDialogOpen: boolean;
  setImportDialogOpen: (open: boolean) => void;
  previewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
  previewMarkdown: string;
  generateDialogOpen: boolean;
  setGenerateDialogOpen: (open: boolean) => void;
  generateTarget: GenerationTargetId;
  setGenerateTarget: (target: GenerationTargetId) => void;
  confirmNewOpen: boolean;
  setConfirmNewOpen: (open: boolean) => void;
  handleSave: () => void;
  handleNew: () => void;
  requestNewWorkflow: () => void;
  handleExport: () => void;
  openGenerateDialog: (target?: GenerationTargetId) => void;
  handleGenerate: () => void;
  handleView: () => void;
  toggleWorkflowGen: () => void;
  toggleSidekick: () => void;
  // Collaboration
  collabRoomId: string | null;
  isCollabActive: boolean;
  isCollabInitializing: boolean;
  collabPeerCount: number;
  handleShare: () => void;
  handleStopSharing: () => void;
}

export function useHeaderController(): HeaderController {
  const name = useWorkflowStore((state) => state.name);
  const setName = useWorkflowStore((state) => state.setName);
  const getWorkflowJSON = useWorkflowStore((state) => state.getWorkflowJSON);
  const reset = useWorkflowStore((state) => state.reset);
  const isDirty = useWorkflowStore((state) => state.isDirty);
  const needsSave = useWorkflowStore((state) => state.needsSave);
  const activeWorkflowId = useSavedWorkflowsStore((state) => state.activeId);
  const openCodeStatus = useOpenCodeStore((state) => state.status);
  const isOpenCodeConnected = openCodeStatus === "connected";
  const isWorkflowGenOpen = useWorkflowGenStore((state) => state.floating);
  const isSidekickOpen = useSidekickStore((state) => state.panelOpen);
  const collabRoomId = useCollabStore((state) => state.roomId);
  const isCollabActive = collabRoomId !== null;
  const isCollabInitializing = useCollabStore((state) => state.isInitializing);
  const collabPeerCount = useCollabStore((state) => state.peerCount);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMarkdown, setPreviewMarkdown] = useState("");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateTarget, setGenerateTarget] = useState<GenerationTargetId>(DEFAULT_GENERATION_TARGET);
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);

  const handleSave = useCallback(() => {
    const json = getWorkflowJSON();
    useSavedWorkflowsStore.getState().save(json);
    toast.success("Workflow saved to library");
  }, [getWorkflowJSON]);

  const handleNew = useCallback(() => {
    reset();
    useSavedWorkflowsStore.getState().clearActiveId();
    window.dispatchEvent(new CustomEvent("nexus:fit-view"));
    toast.success("New workflow created");
  }, [reset]);

  const requestNewWorkflow = useCallback(() => {
    if (needsSave) {
      setConfirmNewOpen(true);
      return;
    }

    handleNew();
  }, [handleNew, needsSave]);

  const handleExport = useCallback(() => {
    exportWorkflow(getWorkflowJSON());
    toast.success("Workflow JSON exported");
  }, [getWorkflowJSON]);

  const openGenerateDialog = useCallback(
    (target: GenerationTargetId = generateTarget) => {
      setGenerateTarget(target);
      setGenerateDialogOpen(true);
    },
    [generateTarget],
  );

  const handleGenerate = useCallback(() => {
    openGenerateDialog();
  }, [openGenerateDialog]);

  const handleView = useCallback(() => {
    const workflow = getWorkflowJSON();
    setPreviewMarkdown(getCommandMarkdown(workflow));
    setPreviewOpen(true);
  }, [getWorkflowJSON]);

  const handleShare = useCallback(() => {
    const id = createRoomId();
    const url = buildCollabShareUrl(id);
    window.history.pushState({}, "", buildCollabRoomUrl(id));
    CollabDoc.getOrCreate().start(id, getWorkflowJSON());
    toast.success("Collaboration started — room state is now persisted on the collab server");
    void navigator.clipboard.writeText(url).catch(() => {/* ignore */});
  }, [getWorkflowJSON]);

  const handleStopSharing = useCallback(() => {
    CollabDoc.getInstance()?.destroy();
    window.history.pushState({}, "", window.location.pathname);
    toast("Collaboration stopped");
  }, []);

  const toggleWorkflowGen = useCallback(() => {
    const store = useWorkflowGenStore.getState();
    store.setFloating(!store.floating);
  }, []);

  const toggleSidekick = useCallback(() => {
    useSidekickStore.getState().togglePanel();
  }, []);

  useEffect(() => {
    const onOpenImport = () => setImportDialogOpen(true);
    const onOpenPreview = () => handleView();
    const onGenerate = () => handleGenerate();
    const onNewWorkflow = () => requestNewWorkflow();
    const onOpenWorkflowGen = () => {
      const store = useWorkflowGenStore.getState();
      store.setFloating(!store.floating);
    };
    const onToggleSidekick = () => useSidekickStore.getState().togglePanel();

    window.addEventListener("nexus:open-import", onOpenImport);
    window.addEventListener("nexus:open-preview", onOpenPreview);
    window.addEventListener("nexus:generate", onGenerate);
    window.addEventListener("nexus:new-workflow-request", onNewWorkflow);
    window.addEventListener("nexus:open-workflow-gen", onOpenWorkflowGen);
    window.addEventListener("nexus:toggle-sidekick", onToggleSidekick);

    return () => {
      window.removeEventListener("nexus:open-import", onOpenImport);
      window.removeEventListener("nexus:open-preview", onOpenPreview);
      window.removeEventListener("nexus:generate", onGenerate);
      window.removeEventListener("nexus:new-workflow-request", onNewWorkflow);
      window.removeEventListener("nexus:open-workflow-gen", onOpenWorkflowGen);
      window.removeEventListener("nexus:toggle-sidekick", onToggleSidekick);
    };
  }, [handleGenerate, handleView, requestNewWorkflow]);

  return {
    name,
    setName,
    isDirty,
    needsSave,
    activeWorkflowId,
    getWorkflowJSON,
    isOpenCodeConnected,
    isWorkflowGenOpen,
    isSidekickOpen,
    importDialogOpen,
    setImportDialogOpen,
    previewOpen,
    setPreviewOpen,
    previewMarkdown,
    generateDialogOpen,
    setGenerateDialogOpen,
    generateTarget,
    setGenerateTarget,
    confirmNewOpen,
    setConfirmNewOpen,
    handleSave,
    handleNew,
    requestNewWorkflow,
    handleExport,
    openGenerateDialog,
    handleGenerate,
    handleView,
    toggleWorkflowGen,
    toggleSidekick,
    collabRoomId,
    isCollabActive,
    isCollabInitializing,
    collabPeerCount,
    handleShare,
    handleStopSharing,
  };
}
