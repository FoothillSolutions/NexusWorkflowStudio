"use client";

import { useEffect, useRef } from "react";
import { Sparkles, PenLine, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOpenCodeStore } from "@/store/opencode-store";
import { usePromptGenStore } from "@/store/prompt-gen-store";
import type { PromptGenNodeType } from "@/store/prompt-gen-store";
import type { FormSetValue } from "@/nodes/shared/form-types";
import { PromptGenBody } from "./prompt-gen-body";

// ── Props ────────────────────────────────────────────────────────────────────

interface AiPromptGeneratorProps {
  setValue: FormSetValue;
  currentPrompt: string;
  nodeId?: string;
  nodeType?: PromptGenNodeType;
}

// ── Component ────────────────────────────────────────────────────────────────

export function AiPromptGenerator({ setValue, currentPrompt, nodeId, nodeType = "agent" }: AiPromptGeneratorProps) {
  const isConnected = useOpenCodeStore((s) => s.status) === "connected";
  const view = usePromptGenStore((s) => s.view);
  const floating = usePromptGenStore((s) => s.floating);
  const targetNodeId = usePromptGenStore((s) => s.targetNodeId);
  const storeOpen = usePromptGenStore((s) => s.open);
  const storeClose = usePromptGenStore((s) => s.close);
  const undock = usePromptGenStore((s) => s.undock);
  const setTargetPrompt = usePromptGenStore((s) => s.setTargetPrompt);
  const registerFormSetValue = usePromptGenStore((s) => s.registerFormSetValue);

  const panelRef = useRef<HTMLDivElement>(null);
  const hasPrompt = currentPrompt.trim().length > 0;
  const isActiveForThisNode = targetNodeId === nodeId && view !== "closed";

  // Register the form's setValue so the store can use it for apply
  useEffect(() => {
    if (isActiveForThisNode) {
      registerFormSetValue(setValue);
    }
    return () => {
      // Only unregister if this node is still the target
      if (usePromptGenStore.getState().targetNodeId === nodeId) {
        registerFormSetValue(null);
      }
    };
  }, [setValue, isActiveForThisNode, nodeId, registerFormSetValue]);

  // Keep the store's targetPrompt in sync with the form's current value
  useEffect(() => {
    if (isActiveForThisNode) {
      setTargetPrompt(currentPrompt);
    }
  }, [currentPrompt, isActiveForThisNode, setTargetPrompt]);

  // Scroll the panel into view when opened (docked)
  useEffect(() => {
    if (isActiveForThisNode && !floating && panelRef.current) {
      const t = setTimeout(() => {
        panelRef.current?.scrollIntoView({ block: "nearest" });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [isActiveForThisNode, floating]);

  // If active for this node but floating, show a compact indicator with dock-back
  if (isActiveForThisNode && floating) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-700/30 bg-violet-950/20 text-[11px] text-violet-300">
        <Sparkles size={12} className="text-violet-400 animate-pulse" />
        <span className="flex-1">AI Generator is floating</span>
      </div>
    );
  }

  // If active and docked, render the full panel inline
  if (isActiveForThisNode && !floating) {
    return (
      <div ref={panelRef} className="rounded-xl border border-violet-800/30 bg-gradient-to-b from-violet-950/30 to-zinc-900/50 overflow-hidden transition-all duration-300 ease-in-out">
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-3.5 py-2 border-b shrink-0",
          view === "edit" ? "bg-amber-950/20 border-amber-800/20" : "bg-violet-950/30 border-violet-800/20",
        )}>
          <div className="flex items-center gap-2">
            {view === "edit"
              ? <PenLine size={14} className="text-amber-400" />
              : <Sparkles size={14} className="text-violet-400" />}
            <span className="text-xs font-semibold text-zinc-200">
              {view === "edit" ? "Edit with AI" : "Generate with AI"}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={undock}
              title="Undock to floating panel"
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            >
              <ExternalLink size={13} />
            </button>
            <button
              type="button"
              onClick={storeClose}
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-3.5 space-y-3.5">
          <PromptGenBody />
        </div>
      </div>
    );
  }

  // Closed — show trigger buttons
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => nodeId && storeOpen(nodeId, currentPrompt, "generate", nodeType)}
        disabled={!isConnected || !nodeId}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 border border-dashed",
          isConnected
            ? "border-violet-700/40 bg-violet-950/20 text-violet-300 hover:bg-violet-950/40 hover:border-violet-600/60 hover:text-violet-200 hover:shadow-lg hover:shadow-violet-950/20"
            : "border-zinc-700/30 bg-zinc-900/20 text-zinc-600 cursor-not-allowed",
        )}
      >
        <Sparkles size={14} className={isConnected ? "text-violet-400" : "text-zinc-600"} />
        Generate with AI
      </button>
      {hasPrompt && (
        <button
          type="button"
          onClick={() => nodeId && storeOpen(nodeId, currentPrompt, "edit", nodeType)}
          disabled={!isConnected || !nodeId}
          className={cn(
            "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 border border-dashed",
            isConnected
              ? "border-amber-700/40 bg-amber-950/20 text-amber-300 hover:bg-amber-950/40 hover:border-amber-600/60 hover:text-amber-200"
              : "border-zinc-700/30 bg-zinc-900/20 text-zinc-600 cursor-not-allowed",
          )}
        >
          <PenLine size={14} />
          Edit with AI
        </button>
      )}
    </div>
  );
}
