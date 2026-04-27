"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Share2, Check, PencilLine, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BG_SURFACE, BORDER_DEFAULT, TEXT_PRIMARY, TEXT_MUTED } from "@/lib/theme";
import { removeRecentWorkspace } from "@/lib/workspace/local-history";
import { toast } from "sonner";

interface WorkspaceHeaderProps {
  workspaceId: string;
  name: string;
  onNameChange: () => void;
}

export function WorkspaceHeader({ workspaceId, name, onNameChange }: WorkspaceHeaderProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(name);
  }, [name]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === name) {
      setEditValue(name);
      return;
    }
    try {
      await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      onNameChange();
    } catch {
      setEditValue(name);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditValue(name);
      setIsEditing(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Workspace URL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete workspace");
      removeRecentWorkspace(workspaceId);
      toast.success("Workspace deleted");
      router.push("/");
    } catch {
      toast.error("Failed to delete workspace");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <header className={`sticky top-0 z-10 border-b ${BORDER_DEFAULT} ${BG_SURFACE}/90 backdrop-blur-sm`}>
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-zinc-400 hover:text-zinc-100"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex-1">
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={`w-full bg-transparent text-lg font-semibold ${TEXT_PRIMARY} outline-none`}
                maxLength={100}
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="group flex items-center gap-2"
              >
                <h1 className={`text-lg font-semibold ${TEXT_PRIMARY}`}>{name}</h1>
                <PencilLine className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-zinc-400" />
              </button>
            )}
            <p className={`text-xs ${TEXT_MUTED}`}>Workspace</p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={isDeleting}
            className="h-8 gap-1.5 rounded-lg px-3 text-xs text-zinc-400 hover:bg-red-950/40 hover:text-red-300"
          >
            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Delete</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="h-8 gap-1.5 rounded-lg px-3 text-xs text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
          </Button>
        </div>
      </header>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title="Delete this workspace?"
        description={
          <>
            This will permanently delete <span className="font-medium text-zinc-200">{name}</span> and all of its workflows.
          </>
        }
        confirmLabel={isDeleting ? "Deleting..." : "Delete workspace"}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </>
  );
}
