"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Users, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BG_APP, BG_SURFACE, BORDER_DEFAULT, TEXT_PRIMARY, TEXT_MUTED } from "@/lib/theme";
import { RecentWorkspaces } from "./recent-workspaces";

export function LandingPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

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
            onClick={handleNewWorkspace}
            className={`flex cursor-pointer flex-col items-center rounded-xl border ${BORDER_DEFAULT} ${BG_SURFACE} p-6 text-center transition-colors hover:bg-zinc-800/80`}
          >
            <Users className="mb-2 h-8 w-8 text-emerald-400" />
            <span className="text-sm font-semibold text-zinc-100">Open Workspace</span>
            <span className={`mt-1 text-xs ${TEXT_MUTED}`}>Collaborative team workspace</span>
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

        <RecentWorkspaces />
      </div>
    </div>
  );
}
