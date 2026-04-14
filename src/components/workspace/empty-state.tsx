"use client";

import { Workflow, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEXT_MUTED } from "@/lib/theme";

interface EmptyStateProps {
  onCreateWorkflow: () => void;
}

export function EmptyState({ onCreateWorkflow }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <Workflow className={`mb-4 h-12 w-12 ${TEXT_MUTED}`} />
      <h2 className="mb-2 text-lg font-medium text-zinc-300">No workflows yet</h2>
      <p className={`mb-6 text-sm ${TEXT_MUTED}`}>
        Create your first workflow to get started
      </p>
      <Button
        variant="outline"
        onClick={onCreateWorkflow}
        className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
      >
        <Plus className="mr-2 h-4 w-4" />
        Create your first workflow
      </Button>
    </div>
  );
}
