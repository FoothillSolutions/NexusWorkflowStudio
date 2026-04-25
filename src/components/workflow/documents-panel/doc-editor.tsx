"use client";

import { useEffect } from "react";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Button } from "@/components/ui/button";
import { openLibraryDocRoom } from "@/lib/collaboration/lib-doc-collab";
import type { LibraryDocumentRecord } from "@/lib/library-store/types";
import type { LibraryScope } from "@/types/library";

interface DocEditorProps {
  workspaceId: string | null;
  scope: LibraryScope;
  packId: string;
  document: LibraryDocumentRecord;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving?: boolean;
}

export function DocEditor({ workspaceId, scope, packId, document, value, onChange, onSave, saving }: DocEditorProps) {
  useEffect(() => {
    if (!workspaceId) return;
    const room = openLibraryDocRoom({
      workspaceId,
      scope,
      packId,
      docId: document.id,
      initialContent: value,
    });
    const handler = () => {
      const text = room.yText.toString();
      if (text && text !== value) {
        onChange(text);
      }
    };
    room.yText.observe(handler);
    return () => {
      room.yText.unobserve(handler);
    };
  }, [workspaceId, scope, packId, document.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="text-sm font-mono text-zinc-300">{document.path}</div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-500">v{document.currentVersionId.slice(0, 6)}</span>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save snapshot"}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <MarkdownEditor value={value} onChange={onChange} height={400} hideToolbar={false} />
      </div>
    </div>
  );
}
