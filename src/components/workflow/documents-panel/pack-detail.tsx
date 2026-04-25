"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileTree } from "./file-tree";
import { DocEditor } from "./doc-editor";
import { MarkdownPreview } from "./markdown-preview";
import { SkillDetailPanel } from "./skill-detail-panel";
import { PublishPanel } from "./publish-panel";
import { BranchStatusPanel } from "./branch-status-panel";
import { ConflictResolveDialog } from "./conflict-resolve-dialog";
import type {
  ConflictRecord,
  LibraryDocumentRecord,
  MergeRecord,
  PackRecord,
  PackVersionRecord,
  SkillRecord,
  ValidationWarning,
  DocumentRole,
} from "@/lib/library-store/types";
import type { LibraryScope } from "@/types/library";

interface PackDetailProps {
  workspaceId: string | null;
  scope: LibraryScope;
  pack: PackRecord;
  documents: LibraryDocumentRecord[];
  skills: SkillRecord[];
  packVersions: PackVersionRecord[];
  selectedDocument: LibraryDocumentRecord | null;
  selectedDocId: string | null;
  draftContent: string;
  setDraftContent: (value: string) => void;
  saving: boolean;
  validationWarnings: ValidationWarning[];
  pendingMerge?: MergeRecord;
  conflicts: ConflictRecord[];
  onSelectDocument: (docId: string) => void;
  onCreateDocument: (role: DocumentRole, path: string, content: string) => void;
  onSaveDocument: () => void;
  onCreateSkill: (skillKey: string, name: string, description: string, entrypointDocId: string) => void;
  onPublishPack: (version: string, notes?: string) => void;
  onPublishSkill: (skillId: string) => void;
  onMergeBase: () => void;
  onResolveConflicts: (resolved: Record<string, string>) => void;
  onValidate: () => void;
  onDeleteDocument: (docId: string) => void;
  onDeleteSkill: (skillId: string) => void;
}

export function PackDetail(props: PackDetailProps) {
  const [creatingDoc, setCreatingDoc] = useState<DocumentRole | null>(null);
  const [docPath, setDocPath] = useState("");
  const [creatingSkill, setCreatingSkill] = useState(false);
  const [skillKey, setSkillKey] = useState("");
  const [skillName, setSkillName] = useState("");
  const [skillDescription, setSkillDescription] = useState("");
  const [skillEntrypointId, setSkillEntrypointId] = useState("");
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);

  const skillEntrypoints = props.documents.filter((d) => d.role === "skill-entrypoint" && d.deletedAt === null);

  return (
    <div className="grid grid-cols-12 gap-3 h-full">
      <div className="col-span-3 space-y-3 overflow-y-auto pr-2">
        <BranchStatusPanel
          pack={props.pack}
          hasPendingMerge={!!props.pendingMerge && props.pendingMerge.status === "conflict"}
          onMergeBase={props.onMergeBase}
          onResolveConflicts={() => setConflictDialogOpen(true)}
        />
        <FileTree
          documents={props.documents}
          selectedDocId={props.selectedDocId}
          onSelect={props.onSelectDocument}
          onCreate={(role) => setCreatingDoc(role)}
          onDelete={props.onDeleteDocument}
        />
        {creatingDoc && (
          <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
            <div className="text-[10px] uppercase font-mono text-zinc-500">New {creatingDoc}</div>
            <Input
              placeholder="path/to/file.md"
              value={docPath}
              onChange={(e) => setDocPath(e.target.value)}
              className="bg-zinc-900 border-zinc-800 h-7 text-xs font-mono"
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                className="h-7 text-xs flex-1"
                disabled={!docPath}
                onClick={() => {
                  props.onCreateDocument(creatingDoc, docPath, "");
                  setDocPath("");
                  setCreatingDoc(null);
                }}
              >
                Create
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreatingDoc(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full" onClick={() => setCreatingSkill((c) => !c)}>
          + New skill
        </Button>
        {creatingSkill && (
          <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
            <Input
              placeholder="skill-key"
              value={skillKey}
              onChange={(e) => setSkillKey(e.target.value)}
              className="bg-zinc-900 border-zinc-800 h-7 text-xs font-mono"
            />
            <Input
              placeholder="Skill name"
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              className="bg-zinc-900 border-zinc-800 h-7 text-xs"
            />
            <Input
              placeholder="Description"
              value={skillDescription}
              onChange={(e) => setSkillDescription(e.target.value)}
              className="bg-zinc-900 border-zinc-800 h-7 text-xs"
            />
            <select
              value={skillEntrypointId}
              onChange={(e) => setSkillEntrypointId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1.5 text-xs"
            >
              <option value="">Select entrypoint document…</option>
              {skillEntrypoints.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.path}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              className="h-7 text-xs w-full"
              disabled={!skillKey || !skillName || !skillEntrypointId}
              onClick={() => {
                props.onCreateSkill(skillKey, skillName, skillDescription, skillEntrypointId);
                setSkillKey("");
                setSkillName("");
                setSkillDescription("");
                setSkillEntrypointId("");
                setCreatingSkill(false);
              }}
            >
              Create skill
            </Button>
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full" onClick={props.onValidate}>
          Validate pack
        </Button>
      </div>
      <div className="col-span-6 flex flex-col h-full overflow-hidden">
        {props.selectedDocument ? (
          <Tabs defaultValue="edit" className="h-full flex flex-col">
            <TabsList>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="flex-1 overflow-hidden">
              <DocEditor
                workspaceId={props.workspaceId}
                scope={props.scope}
                packId={props.pack.id}
                document={props.selectedDocument}
                value={props.draftContent}
                onChange={props.setDraftContent}
                onSave={props.onSaveDocument}
                saving={props.saving}
              />
            </TabsContent>
            <TabsContent value="preview" className="flex-1 overflow-hidden">
              <MarkdownPreview source={props.draftContent} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Select a document to edit
          </div>
        )}
      </div>
      <div className="col-span-3 space-y-3 overflow-y-auto pl-2">
        <SkillDetailPanel
          skills={props.skills}
          validationWarnings={props.validationWarnings}
          onPublishSkill={(skillId) => props.onPublishSkill(skillId)}
          onDeleteSkill={props.onDeleteSkill}
        />
        <PublishPanel packVersions={props.packVersions} onPublishPack={props.onPublishPack} />
      </div>
      <ConflictResolveDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
        conflicts={props.conflicts}
        onResolve={props.onResolveConflicts}
      />
    </div>
  );
}
