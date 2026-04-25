"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, ExternalLink, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BG_SURFACE, BORDER_DEFAULT, TEXT_PRIMARY, TEXT_MUTED, TEXT_SECONDARY } from "@/lib/theme";
import type { WorkflowRecord } from "@/lib/workspace/types";

interface WorkflowCardProps {
  workspaceId: string;
  workflow: WorkflowRecord;
  onDelete: () => void;
  onRename: () => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function WorkflowCard({ workspaceId, workflow, onDelete, onRename }: WorkflowCardProps) {
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(workflow.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRename = async () => {
    setIsRenaming(false);
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === workflow.name) {
      setRenameValue(workflow.name);
      return;
    }
    try {
      await fetch(`/api/workspaces/${workspaceId}/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      onRename();
    } catch {
      setRenameValue(workflow.name);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleRename();
    if (e.key === "Escape") {
      setRenameValue(workflow.name);
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    try {
      await fetch(`/api/workspaces/${workspaceId}/workflows/${workflow.id}`, {
        method: "DELETE",
      });
      onDelete();
    } catch {
      // ignore
    }
  };

  const handleOpen = () => {
    router.push(`/workspace/${workspaceId}/workflow/${workflow.id}`);
  };

  return (
    <div
      className={`group relative rounded-xl ${BG_SURFACE} border ${BORDER_DEFAULT} p-4 transition-colors hover:bg-zinc-800/60`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyDown}
              className={`w-full bg-transparent text-sm font-medium ${TEXT_PRIMARY} outline-none`}
              maxLength={200}
            />
          ) : (
            <h3
              className={`cursor-pointer truncate text-sm font-medium ${TEXT_PRIMARY} hover:underline`}
              onClick={handleOpen}
            >
              {workflow.name}
            </h3>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={handleOpen}>
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsRenaming(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-red-400 focus:text-red-400"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={`mt-4 flex items-center gap-3 text-xs ${TEXT_MUTED}`}>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo(workflow.updatedAt)}
        </span>
        {workflow.lastModifiedBy && (
          <span className={`flex items-center gap-1 ${TEXT_SECONDARY}`}>
            <User className="h-3 w-3" />
            {workflow.lastModifiedBy}
          </span>
        )}
      </div>
    </div>
  );
}
