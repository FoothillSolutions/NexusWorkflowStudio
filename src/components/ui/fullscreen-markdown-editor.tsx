"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Eye, SplitSquareHorizontal, Code } from "lucide-react";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
const MarkdownPreview = dynamic(
  () => import("@uiw/react-markdown-preview").then((mod) => mod.default),
  { ssr: false }
);

type ViewMode = "edit" | "split" | "preview";

interface FullscreenMarkdownEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSave: (value: string) => void;
}

export function FullscreenMarkdownEditor({
  open,
  onOpenChange,
  value,
  onSave,
}: FullscreenMarkdownEditorProps) {
  const [draft, setDraft] = useState(value);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  // Sync draft when dialog opens
  useEffect(() => {
    if (open) {
      setDraft(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = useCallback(() => {
    onSave(draft);
    onOpenChange(false);
  }, [draft, onSave, onOpenChange]);

  const hasChanges = draft !== value;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[90vw] !w-[90vw] !max-h-[90vh] !h-[90vh] bg-zinc-900 border-zinc-700/50 flex flex-col gap-0 p-0 rounded-2xl"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between px-5 py-3 border-b border-zinc-700/50 shrink-0">
          <DialogTitle className="text-zinc-100 text-base font-semibold">
            Prompt Editor
          </DialogTitle>
          <div className="flex items-center gap-2">
            {/* View Mode Tabs */}
            <Tabs
              value={viewMode}
              onValueChange={(v) => setViewMode(v as ViewMode)}
            >
              <TabsList className="bg-zinc-950/70 border border-zinc-700/50 rounded-xl h-8">
                <TabsTrigger
                  value="edit"
                  className="rounded-lg data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 text-zinc-500 cursor-pointer text-xs px-2.5 h-6 gap-1.5"
                >
                  <Code size={13} />
                  Edit
                </TabsTrigger>
                <TabsTrigger
                  value="split"
                  className="rounded-lg data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 text-zinc-500 cursor-pointer text-xs px-2.5 h-6 gap-1.5"
                >
                  <SplitSquareHorizontal size={13} />
                  Split
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="rounded-lg data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 text-zinc-500 cursor-pointer text-xs px-2.5 h-6 gap-1.5"
                >
                  <Eye size={13} />
                  Preview
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="nexus-md-editor flex-1 min-h-0 overflow-hidden fullscreen-md-editor" data-color-mode="dark">
          {viewMode === "edit" && (
            <div className="h-full">
              <MDEditor
                className="nexus-md-editor"
                value={draft}
                onChange={(val) => setDraft(val ?? "")}
                height="100%"
                preview="edit"
                hideToolbar={false}
                visibleDragbar={false}
                textareaProps={{
                  placeholder: "Write your prompt in Markdown…",
                }}
                style={{
                  background: "transparent",
                  height: "100%",
                }}
              />
            </div>
          )}

          {viewMode === "split" && (
            <div className="flex h-full divide-x divide-zinc-700/50">
              {/* Editor pane */}
              <div className="flex-1 min-w-0 h-full">
                <MDEditor
                  className="nexus-md-editor"
                  value={draft}
                  onChange={(val) => setDraft(val ?? "")}
                  height="100%"
                  preview="edit"
                  hideToolbar={false}
                  visibleDragbar={false}
                  textareaProps={{
                    placeholder: "Write your prompt in Markdown…",
                  }}
                  style={{
                    background: "transparent",
                    height: "100%",
                  }}
                />
              </div>
              {/* Preview pane */}
              <div className="flex-1 min-w-0 h-full overflow-auto p-5 bg-zinc-950/50">
                <MarkdownPreview
                  source={draft}
                  style={{ background: "transparent" }}
                />
              </div>
            </div>
          )}

          {viewMode === "preview" && (
            <div className="h-full overflow-auto p-6 bg-zinc-950/50">
              <MarkdownPreview
                source={draft}
                style={{ background: "transparent" }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-zinc-700/50 shrink-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-zinc-400 hover:text-zinc-100"
          >
            Cancel
          </Button>
          <Button
            onClick={hasChanges ? handleSave : () => onOpenChange(false)}
            className={cn(
              "rounded-xl gap-2",
              hasChanges
                ? "bg-zinc-100 text-zinc-900 hover:bg-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            )}
          >
            <Check size={14} />
            {hasChanges ? "Save Changes" : "Ok"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

