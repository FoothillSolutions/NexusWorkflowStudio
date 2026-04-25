"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Library, Upload, X } from "lucide-react";
import { useDocumentsPanelController } from "./use-documents-panel-controller";
import { PackBrowser } from "./pack-browser";
import { PackDetail } from "./pack-detail";
import { ImportDialog } from "./import-dialog";
import { useLibraryDocsStore } from "@/store/library-docs";
import type { ValidationWarning } from "@/types/library";
import {
  DOCUMENTS_PANEL_SHELL_CLASS,
  DOCUMENTS_PANEL_SURFACE_CLASS,
} from "./constants";
import type { DocumentsPanelProps } from "./types";

const EMPTY_WARNINGS: ValidationWarning[] = [];

export default function DocumentsPanel({ open, onClose }: DocumentsPanelProps) {
  const c = useDocumentsPanelController(open);
  const selectedPackId = c.selectedPack?.id;
  const validationWarnings = useLibraryDocsStore(
    (s) => (selectedPackId ? s.validationWarnings[selectedPackId] : undefined) ?? EMPTY_WARNINGS,
  );
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <div
        className={`${DOCUMENTS_PANEL_SHELL_CLASS} ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-4 opacity-0"
        }`}
        style={{
          width: "min(1100px, calc(100vw - 32px))",
          height: "calc(100vh - 112px)",
          maxHeight: "calc(100vh - 112px)",
        }}
      >
        <div className={DOCUMENTS_PANEL_SURFACE_CLASS}>
          <div className="shrink-0 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Library className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-semibold text-zinc-100">Documents Skill Library</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setImportOpen(true)}>
                <Upload className="h-3.5 w-3.5" /> Import
              </Button>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-12 overflow-hidden">
            <div className="col-span-3 border-r border-zinc-800 p-3 overflow-y-auto space-y-3">
              <Tabs value={c.scope} onValueChange={(v) => c.setScope(v as "workspace" | "user")}>
                <TabsList className="w-full">
                  <TabsTrigger value="workspace" className="flex-1">Workspace</TabsTrigger>
                  <TabsTrigger value="user" className="flex-1">User-local</TabsTrigger>
                </TabsList>
              </Tabs>
              <PackBrowser
                packs={c.packs}
                selectedPackId={c.selectedPack?.id ?? null}
                onSelectPack={c.selectPack}
                onCreatePack={c.createPack}
                onForkPack={c.forkPack}
                onDeletePack={async (id) => {
                  await useLibraryDocsStore.getState().softDeletePack(id);
                }}
              />
            </div>
            <div className="col-span-9 p-3 overflow-hidden">
              {c.selectedPack && c.workspaceId ? (
                <PackDetail
                  workspaceId={c.workspaceId}
                  scope={c.scope}
                  pack={c.selectedPack}
                  documents={c.documents}
                  skills={c.skills}
                  packVersions={c.packVersions}
                  selectedDocument={c.selectedDocument}
                  selectedDocId={c.selectedDocId}
                  draftContent={c.draftContent}
                  setDraftContent={c.setDraftContent}
                  saving={c.saving}
                  validationWarnings={validationWarnings}
                  pendingMerge={c.selectedPack ? c.pendingMerges[c.selectedPack.id] : undefined}
                  conflicts={
                    c.selectedPack && c.pendingMerges[c.selectedPack.id]
                      ? c.conflicts[c.pendingMerges[c.selectedPack.id]!.id] ?? []
                      : []
                  }
                  onSelectDocument={c.selectDocument}
                  onCreateDocument={c.createDocument}
                  onSaveDocument={c.saveDocument}
                  onCreateSkill={c.createSkill}
                  onPublishPack={c.publishPack}
                  onPublishSkill={(skillId) => {
                    const v = window.prompt("Skill version (semver)");
                    if (v) c.publishSkill(skillId, v);
                  }}
                  onMergeBase={c.mergeBase}
                  onResolveConflicts={async (resolved) => {
                    if (!c.selectedPack) return;
                    const merge = c.pendingMerges[c.selectedPack.id];
                    if (!merge) return;
                    await useLibraryDocsStore.getState().resolveConflict(c.selectedPack.id, merge.id, resolved);
                  }}
                  onValidate={c.validatePack}
                  onDeleteDocument={async (docId) => {
                    if (!c.selectedPack) return;
                    await useLibraryDocsStore.getState().deleteDocument(c.selectedPack.id, docId);
                  }}
                  onDeleteSkill={async (skillId) => {
                    if (!c.selectedPack) return;
                    await useLibraryDocsStore.getState().deleteSkill(c.selectedPack.id, skillId);
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  Select or create a pack to begin
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={c.importArchive} />
    </>
  );
}
