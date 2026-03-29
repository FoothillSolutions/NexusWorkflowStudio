"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
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
import { CodeEditor } from "./code-editor";
import { CodePreview } from "./code-preview";

type ViewMode = "edit" | "split" | "preview";

interface FullscreenCodeEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSave: (value: string) => void;
  language?: string;
  title?: string;
  placeholder?: string;
}

export function FullscreenCodeEditor({
  open,
  onOpenChange,
  value,
  onSave,
  language = "typescript",
  title = "Code Editor",
  placeholder = "Write your code…",
}: FullscreenCodeEditorProps) {
  const [draft, setDraft] = useState(value);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => setDraft(value), 0);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [open, value]);

  const handleSave = useCallback(() => {
    onSave(draft);
    onOpenChange(false);
  }, [draft, onSave, onOpenChange]);

  const hasChanges = draft !== value;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[90vw]! w-[90vw]! max-h-[90vh]! h-[90vh]! bg-zinc-900 border-zinc-700/50 flex flex-col gap-0 p-0 rounded-2xl"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between px-5 py-3 border-b border-zinc-700/50 shrink-0">
          <DialogTitle className="text-zinc-100 text-base font-semibold">{title}</DialogTitle>
          <Tabs value={viewMode} onValueChange={(nextValue) => setViewMode(nextValue as ViewMode)}>
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
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {viewMode === "edit" && (
            <div className="h-full p-4">
              <CodeEditor
                value={draft}
                onChange={setDraft}
                language={language}
                placeholder={placeholder}
                height="100%"
              />
            </div>
          )}

          {viewMode === "split" && (
            <div className="flex h-full divide-x divide-zinc-700/50">
              <div className="flex-1 min-w-0 p-4">
                <CodeEditor
                  value={draft}
                  onChange={setDraft}
                  language={language}
                  placeholder={placeholder}
                  height="100%"
                />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden bg-zinc-950/40">
                <CodePreview
                  value={draft}
                  language={language}
                  className="h-full overflow-auto p-5"
                  emptyMessage="Write your script to preview it here…"
                />
              </div>
            </div>
          )}

          {viewMode === "preview" && (
            <div className="h-full overflow-hidden bg-zinc-950/40">
              <CodePreview
                value={draft}
                language={language}
                className="h-full overflow-auto p-6"
                emptyMessage="Write your script to preview it here…"
              />
            </div>
          )}
        </div>

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

