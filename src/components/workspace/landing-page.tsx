"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Users, Plus, Loader2, X, Clock, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BG_APP, BG_SURFACE, BORDER_DEFAULT, TEXT_PRIMARY, TEXT_MUTED } from "@/lib/theme";
import { RecentWorkspaces } from "./recent-workspaces";

interface WorkspaceEntry {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export function LandingPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerWorkspaces, setPickerWorkspaces] = useState<WorkspaceEntry[]>([]);

  const fetchWorkspaces = useCallback(async () => {
    setPickerLoading(true);
    try {
      const res = await fetch("/api/workspaces");
      if (res.ok) {
        const { workspaces } = await res.json();
        setPickerWorkspaces(workspaces);
      }
    } finally {
      setPickerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showPicker) {
      fetchWorkspaces();
    }
  }, [showPicker, fetchWorkspaces]);

  const handleNewWorkspace = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Workspace" }),
      });
      if (!res.ok) throw new Error("Failed to create workspace");
      const { workspace } = await res.json();
      router.push(`/workspace/${workspace.id}`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className={`flex min-h-screen flex-col items-center justify-center ${BG_APP} ${TEXT_PRIMARY} p-6`}>
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Nexus Workflow Studio</h1>
          <p className={`mt-2 text-sm ${TEXT_MUTED}`}>Build, share, and collaborate on AI agent workflows</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => router.push("/editor")}
            className={`flex cursor-pointer flex-col items-center rounded-xl border ${BORDER_DEFAULT} ${BG_SURFACE} p-6 text-center transition-colors hover:bg-zinc-800/80`}
          >
            <Pencil className="mb-2 h-8 w-8 text-blue-400" />
            <span className="text-sm font-semibold text-zinc-100">Open Editor</span>
            <span className={`mt-1 text-xs ${TEXT_MUTED}`}>Standalone workflow editor</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className={`flex cursor-pointer flex-col items-center rounded-xl border ${BORDER_DEFAULT} ${BG_SURFACE} p-6 text-center transition-colors hover:bg-zinc-800/80`}
          >
            <Users className="mb-2 h-8 w-8 text-emerald-400" />
            <span className="text-sm font-semibold text-zinc-100">Open Workspace</span>
            <span className={`mt-1 text-xs ${TEXT_MUTED}`}>Browse existing workspaces</span>
          </button>
        </div>

        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewWorkspace}
            disabled={creating}
            className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            {creating ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-2 h-3.5 w-3.5" />
            )}
            New workspace
          </Button>
        </div>

        {showPicker && (
          <div className={`w-full rounded-xl border ${BORDER_DEFAULT} ${BG_SURFACE} p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className={`text-sm font-medium ${TEXT_PRIMARY}`}>
                <FolderOpen className="mr-1.5 inline-block h-4 w-4" />
                Select a workspace
              </h2>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className={`rounded p-1 ${TEXT_MUTED} transition-colors hover:bg-zinc-800 hover:text-zinc-100`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {pickerLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className={`h-5 w-5 animate-spin ${TEXT_MUTED}`} />
              </div>
            ) : pickerWorkspaces.length === 0 ? (
              <p className={`py-6 text-center text-sm ${TEXT_MUTED}`}>
                No workspaces yet. Create one to get started.
              </p>
            ) : (
              <div className="space-y-1.5">
                {pickerWorkspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => router.push(`/workspace/${ws.id}`)}
                    className={`flex w-full items-center gap-3 rounded-lg border ${BORDER_DEFAULT} bg-zinc-900/60 px-4 py-3 text-left transition-colors hover:bg-zinc-800/80`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-200">{ws.name}</p>
                      <span className={`mt-0.5 flex items-center gap-1 text-xs ${TEXT_MUTED}`}>
                        <Clock className="h-3 w-3" />
                        Updated {new Date(ws.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <RecentWorkspaces />
      </div>
    </div>
  );
}
