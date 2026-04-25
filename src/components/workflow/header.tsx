"use client";

import { getGenerationTarget } from "@/lib/generation-targets";
import { BG_SURFACE, BORDER_DEFAULT } from "@/lib/theme";
import { HelpMenu } from "./shared-header-actions";
import { HeaderBrand } from "./header/brand";
import { HeaderDialogs } from "./header/dialogs";
import { HeaderGenerateMenu } from "./header/generate-menu";
import { HeaderSessionActions } from "./header/session-actions";
import { useHeaderController } from "./header/use-header-controller";
import { HeaderWorkflowActions } from "./header/workflow-actions";
import { WorkflowNameCard } from "./header/workflow-name-card";

export default function Header() {
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

  const generationTargetLabel = getGenerationTarget(generateTarget).label;

  return (
    <header
      className={`nexus-no-select z-10 shrink-0 border-b ${BORDER_DEFAULT} ${BG_SURFACE}/90 px-3 py-2 backdrop-blur-sm`}
    >
      <div className="flex w-full flex-wrap items-center gap-2">
        <HeaderBrand />

        <div className="hidden h-6 w-px shrink-0 bg-zinc-800/80 xl:block" />

        <WorkflowNameCard
          name={name}
          setName={setName}
          isDirty={isDirty}
          needsSave={needsSave}
          activeWorkflowId={activeWorkflowId}
          generationTargetLabel={generationTargetLabel}
          generationTargetId={generateTarget}
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
