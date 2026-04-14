"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getGenerationTarget } from "@/lib/generation-targets";
import { buildWorkspaceCollabShareUrl } from "@/lib/collaboration/config";
import { BG_SURFACE, BORDER_DEFAULT, TEXT_MUTED } from "@/lib/theme";
import { HelpMenu } from "./shared-header-actions";
import { HeaderBrand } from "./header/brand";
import { HeaderDialogs } from "./header/dialogs";
import { HeaderGenerateMenu } from "./header/generate-menu";
import { HeaderSessionActions } from "./header/session-actions";
import { useHeaderController } from "./header/use-header-controller";
import { HeaderWorkflowActions } from "./header/workflow-actions";
import { WorkflowNameCard } from "./header/workflow-name-card";
import { ShareButton } from "./collaboration/share-button";
import { PresenceAvatars } from "./collaboration/presence-avatars";

export interface WorkspaceContext {
  workspaceId: string;
  workflowId: string;
}

interface HeaderProps {
  workspaceContext?: WorkspaceContext;
}

export default function Header({ workspaceContext }: HeaderProps) {
  const {
    name,
    setName,
    isDirty,
    needsSave,
    activeWorkflowId,
    getWorkflowJSON,
    isOpenCodeConnected,
    isWorkflowGenOpen,
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
  } = useHeaderController();

  const router = useRouter();
  const generationTargetLabel = getGenerationTarget(generateTarget).label;

  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  useEffect(() => {
    if (!workspaceContext) return;
    (async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceContext.workspaceId}`);
        if (res.ok) {
          const data = await res.json();
          setWorkspaceName(data.workspace?.name ?? null);
        }
      } catch { /* ignore */ }
    })();
  }, [workspaceContext]);

  const handleWorkspaceRename = useCallback(async (newName: string) => {
    if (!workspaceContext) return;
    await fetch(`/api/workspaces/${workspaceContext.workspaceId}/workflows/${workspaceContext.workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
  }, [workspaceContext]);

  const workspaceShareUrl = workspaceContext
    ? buildWorkspaceCollabShareUrl(workspaceContext.workspaceId, workspaceContext.workflowId)
    : undefined;

  return (
    <header
      className={`nexus-no-select z-10 shrink-0 border-b ${BORDER_DEFAULT} ${BG_SURFACE}/90 px-3 py-2 backdrop-blur-sm`}
    >
      <div className="flex w-full flex-wrap items-center gap-2">
        {workspaceContext && (
          <button
            type="button"
            onClick={() => router.push(`/workspace/${workspaceContext.workspaceId}`)}
            className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs ${TEXT_MUTED} transition-colors hover:bg-zinc-800/80 hover:text-zinc-200`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{workspaceName ?? "Workspace"}</span>
          </button>
        )}

        <HeaderBrand />

        <div className="hidden h-6 w-px shrink-0 bg-zinc-800/80 xl:block" />

        <WorkflowNameCard
          name={name}
          setName={setName}
          isDirty={isDirty}
          needsSave={needsSave}
          activeWorkflowId={activeWorkflowId}
          generationTargetLabel={generationTargetLabel}
          onRename={workspaceContext ? handleWorkspaceRename : undefined}
        />

        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
          <HeaderSessionActions
            isOpenCodeConnected={isOpenCodeConnected}
            isWorkflowGenOpen={isWorkflowGenOpen}
            onToggleWorkflowGen={toggleWorkflowGen}
          />

          <HeaderWorkflowActions
            onRequestNewWorkflow={requestNewWorkflow}
            onSave={handleSave}
            onOpenImport={() => setImportDialogOpen(true)}
            onExport={handleExport}
            onPreview={handleView}
            showPreview={process.env.NODE_ENV === "development"}
          />

          <HeaderGenerateMenu
            generateTarget={generateTarget}
            onOpenGenerateDialog={openGenerateDialog}
          />

          <PresenceAvatars />

          <ShareButton shareUrlOverride={workspaceShareUrl} />

          <HelpMenu className="rounded-lg border border-transparent bg-transparent hover:bg-zinc-800/80" />
        </div>
      </div>

      <HeaderDialogs
        importDialogOpen={importDialogOpen}
        onImportDialogOpenChange={setImportDialogOpen}
        previewOpen={previewOpen}
        onPreviewOpenChange={setPreviewOpen}
        previewMarkdown={previewMarkdown}
        workflowName={name}
        generateDialogOpen={generateDialogOpen}
        onGenerateDialogOpenChange={setGenerateDialogOpen}
        generateTarget={generateTarget}
        onGenerateTargetChange={setGenerateTarget}
        getWorkflow={getWorkflowJSON}
        onPreviewDownload={handleGenerate}
        confirmNewOpen={confirmNewOpen}
        onConfirmNewOpenChange={setConfirmNewOpen}
        onConfirmNewWorkflow={handleNew}
      />
    </header>
  );
}
