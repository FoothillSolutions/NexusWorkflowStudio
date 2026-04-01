"use client";
import type React from "react";
import { useState, useCallback, useMemo, useRef } from "react";
import { useWatch } from "react-hook-form";
import { FullscreenMarkdownEditor } from "@/components/ui/fullscreen-markdown-editor";
import { toast } from "sonner";
import type { FormControl, FormSetValue, FormRegister } from "@/nodes/shared/form-types";
import { useWorkflowStore } from "@/store/workflow";
import {
  DOC_NAME_REGEX,
  DOC_SUBFOLDER_REGEX,
  collectDocumentSubfolders,
  getDocumentDisplayPath,
  normalizeDocSubfolder,
} from "./utils";
import { DocumentContentSection } from "./fields/document-content-section";
import { DocumentIdentitySection } from "./fields/document-identity-section";
import { PlainTextEditorDialog } from "./fields/plain-text-editor-dialog";
import type { DocumentContentMode, DocumentNodeData } from "./types";

const ALLOWED_EXTENSIONS = ["md", "txt", "json", "yaml", "yml"] as const;


interface DocumentFieldsProps {
  register: FormRegister;
  control: FormControl;
  setValue: FormSetValue;
}

export function Fields({ control, setValue }: DocumentFieldsProps) {
  const docName: string = useWatch({ control, name: "docName" }) ?? "";
  const docSubfolder: string = useWatch({ control, name: "docSubfolder" }) ?? "";
  const contentMode: DocumentContentMode = useWatch({ control, name: "contentMode" }) ?? "inline";
  const fileExtension: DocumentNodeData["fileExtension"] = useWatch({ control, name: "fileExtension" }) ?? "md";
  const contentText: string = useWatch({ control, name: "contentText" }) ?? "";
  const linkedFileName: string | null = useWatch({ control, name: "linkedFileName" }) ?? null;

  const [editorOpen, setEditorOpen] = useState(false);
  const [isCreatingSubfolder, setIsCreatingSubfolder] = useState(false);
  const [newSubfolder, setNewSubfolder] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workflowNodes = useWorkflowStore((s) => s.nodes);
  const activeSubWorkflowNodes = useWorkflowStore((s) => s.subWorkflowNodes);

  const isValidDocName = !docName || DOC_NAME_REGEX.test(docName);
  const sharedSubfolders = useMemo(() => {
    const folders = new Set<string>(collectDocumentSubfolders(workflowNodes));
    for (const folder of collectDocumentSubfolders(activeSubWorkflowNodes)) {
      folders.add(folder);
    }
    return [...folders].sort((a, b) => a.localeCompare(b));
  }, [activeSubWorkflowNodes, workflowNodes]);
  const subfolderOptions = useMemo(() => {
    const folders = new Set(sharedSubfolders);
    if (docSubfolder.trim()) folders.add(docSubfolder.trim());
    return [...folders].sort((a, b) => a.localeCompare(b));
  }, [docSubfolder, sharedSubfolders]);
  const outputPathPreview = useMemo(
    () => `docs/${getDocumentDisplayPath({ docName, docSubfolder, fileExtension })}`,
    [docName, docSubfolder, fileExtension],
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const normalizedExt = ext === "yml" ? "yaml" : ext;

      if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
        toast.error(`Unsupported file type: .${ext}. Use .md, .txt, .json, or .yaml`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setValue("linkedFileName" as never, file.name as never, { shouldDirty: true });
        setValue("linkedFileContent" as never, text as never, { shouldDirty: true });
        setValue("fileExtension" as never, normalizedExt as never, { shouldDirty: true });
        toast.success(`Loaded ${file.name}`);
      };
      reader.onerror = () => toast.error("Failed to read file");
      reader.readAsText(file);

      // Reset so the same file can be re-uploaded
      e.target.value = "";
    },
    [setValue]
  );

  const clearLinkedFile = useCallback(() => {
    setValue("linkedFileName" as never, null as never, { shouldDirty: true });
    setValue("linkedFileContent" as never, null as never, { shouldDirty: true });
  }, [setValue]);

  const handleEditorSave = useCallback(
    (val: string) => {
      setValue("contentText" as never, val as never, { shouldDirty: true });
    },
    [setValue]
  );

  const handleCreateSubfolder = useCallback(() => {
    const normalized = normalizeDocSubfolder(newSubfolder);
    if (!normalized) {
      toast.error("Enter a subfolder name first");
      return;
    }
    if (!DOC_SUBFOLDER_REGEX.test(normalized)) {
      toast.error("Subfolder must use lowercase letters, digits, and single hyphens only");
      return;
    }

    setValue("docSubfolder" as never, normalized as never, { shouldDirty: true });
    setNewSubfolder("");
    setIsCreatingSubfolder(false);
    toast.success(`Selected docs/${normalized}`);
  }, [newSubfolder, setValue]);

  const handleToggleCreateSubfolder = useCallback(() => {
    setIsCreatingSubfolder((prev) => !prev);
    setNewSubfolder(docSubfolder);
  }, [docSubfolder]);

  const handleNewSubfolderChange = useCallback((value: string) => {
    setNewSubfolder(normalizeDocSubfolder(value));
  }, []);

  const handleNewSubfolderKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleCreateSubfolder();
    },
    [handleCreateSubfolder],
  );

  return (
    <div className="space-y-4 overflow-hidden">
      <DocumentIdentitySection
        control={control}
        isValidDocName={isValidDocName}
        subfolderOptions={subfolderOptions}
        isCreatingSubfolder={isCreatingSubfolder}
        newSubfolder={newSubfolder}
        outputPathPreview={outputPathPreview}
        onToggleCreateSubfolder={handleToggleCreateSubfolder}
        onNewSubfolderChange={handleNewSubfolderChange}
        onNewSubfolderKeyDown={handleNewSubfolderKeyDown}
        onCreateSubfolder={handleCreateSubfolder}
      />

      <DocumentContentSection
        control={control}
        contentMode={contentMode}
        contentText={contentText}
        linkedFileName={linkedFileName}
        fileInputRef={fileInputRef}
        onOpenEditor={() => setEditorOpen(true)}
        onFileUpload={handleFileUpload}
        onClearLinkedFile={clearLinkedFile}
      />

      {/* Fullscreen Content Editor Dialog */}
      {contentMode === "inline" && fileExtension === "md" && (
        <FullscreenMarkdownEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          value={contentText}
          onSave={handleEditorSave}
        />
      )}

      {/* Fullscreen plain-text editor for non-markdown */}
      {contentMode === "inline" && fileExtension !== "md" && editorOpen && (
        <PlainTextEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          value={contentText}
          onSave={handleEditorSave}
          fileExtension={fileExtension}
        />
      )}

    </div>
  );
}

