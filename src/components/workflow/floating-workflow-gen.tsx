"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Workflow,
  Zap,
  StopCircle,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useWorkflowGenStore } from "@/store/workflow-gen-store";
import { useOpenCodeStore } from "@/store/opencode-store";
import { useModels } from "@/hooks/use-models";
import { toast } from "sonner";

// ── Example prompts ──────────────────────────────────────────────────────────
const EXAMPLE_PROMPTS = [
  "A code review workflow with an agent that analyzes PRs, checks for issues using if-else branching, and provides feedback",
  "A customer support workflow with an ask-user node to classify the issue, then routes to different specialist agents via a switch node",
  "A content generation pipeline with a research agent, writing agent with connected skills for SEO and tone, and an editor agent",
  "A data processing workflow that validates input, transforms data through multiple agents, and handles errors with if-else",
];

// ── Component ────────────────────────────────────────────────────────────────
// Floating panel for AI workflow generation, positioned top-center under the header.
// Replaces the old modal dialog approach so nodes stream onto the canvas in real-time.

export default function FloatingWorkflowGen() {
  const floating = useWorkflowGenStore((s) => s.floating);
  const collapsed = useWorkflowGenStore((s) => s.collapsed);
  const status = useWorkflowGenStore((s) => s.status);
  const prompt = useWorkflowGenStore((s) => s.prompt);
  const selectedModel = useWorkflowGenStore((s) => s.selectedModel);
  const parsedNodeCount = useWorkflowGenStore((s) => s.parsedNodeCount);
  const parsedEdgeCount = useWorkflowGenStore((s) => s.parsedEdgeCount);
  const tokenCount = useWorkflowGenStore((s) => s.tokenCount);
  const error = useWorkflowGenStore((s) => s.error);
  const streamedText = useWorkflowGenStore((s) => s.streamedText);

  const setPrompt = useWorkflowGenStore((s) => s.setPrompt);
  const setSelectedModel = useWorkflowGenStore((s) => s.setSelectedModel);
  const generate = useWorkflowGenStore((s) => s.generate);
  const cancel = useWorkflowGenStore((s) => s.cancel);
  const reset = useWorkflowGenStore((s) => s.reset);
  const close = useWorkflowGenStore((s) => s.close);
  const toggleCollapsed = useWorkflowGenStore((s) => s.toggleCollapsed);

  const connectionStatus = useOpenCodeStore((s) => s.status);
  const isConnected = connectionStatus === "connected";

  const { groups, isLoading: modelsLoading } = useModels();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = status === "streaming" || status === "creating-session";
  const isDone = status === "done";
  const isError = status === "error";

  // Auto-select first model if none selected
  useEffect(() => {
    if (!selectedModel && groups.length > 0) {
      const firstGroup = groups[0];
      if (firstGroup.models.length > 0) {
        setSelectedModel(firstGroup.models[0].value);
      }
    }
  }, [groups, selectedModel, setSelectedModel]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (floating && !collapsed && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [floating, collapsed]);

  const handleGenerate = useCallback(async () => {
    await generate();
    const newStatus = useWorkflowGenStore.getState().status;
    if (newStatus === "done") {
      toast.success("Workflow generated successfully!");
    }
  }, [generate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isStreaming) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate, isStreaming],
  );

  const handleClose = useCallback(() => {
    if (isStreaming) {
      cancel();
    }
    reset();
    close();
  }, [isStreaming, cancel, reset, close]);

  const handleExampleClick = useCallback(
    (example: string) => {
      setPrompt(example);
      textareaRef.current?.focus();
    },
    [setPrompt],
  );

  // Don't render when not floating
  if (!floating) return null;

  return (
    <div
      className={cn(
        "absolute z-40 flex flex-col rounded-2xl border bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden",
        "animate-in slide-in-from-top-4 fade-in-0 duration-200",
        "border-violet-700/30",
      )}
      style={{
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        width: 520,
        maxHeight: collapsed ? undefined : "calc(100vh - 140px)",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b shrink-0 bg-violet-950/30 border-violet-800/20">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={14} className="text-violet-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-semibold text-zinc-200 block">
              Generate Workflow with AI
            </span>
            {isStreaming && (
              <span className="text-[10px] text-violet-400/80 block">
                Streaming nodes to canvas…
              </span>
            )}
            {isDone && (
              <span className="text-[10px] text-emerald-400/80 block">
                Complete — {parsedNodeCount} nodes, {parsedEdgeCount} edges
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Collapse / expand toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand" : "Collapse"}
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {/* Close */}
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Collapsed status bar ──────────────────────────────────── */}
      {collapsed && (
        <div className="px-3.5 py-2 flex items-center gap-2 text-[11px] text-zinc-400">
          {isStreaming ? (
            <>
              <Loader2 size={11} className="text-violet-400 animate-spin" />
              Generating… {parsedNodeCount} nodes, {parsedEdgeCount} edges
            </>
          ) : isDone ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Complete — {parsedNodeCount} nodes, {parsedEdgeCount} edges
            </>
          ) : isError ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
              Error
            </>
          ) : (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-600" />
              Ready
            </>
          )}
        </div>
      )}

      {/* ── Body (hidden when collapsed) ──────────────────────────── */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto min-h-0 p-3.5 space-y-3.5">
          {/* ── Connection warning ──────────────────────────────── */}
          {!isConnected && (
            <div className="flex items-center gap-2 text-amber-400 bg-amber-950/20 border border-amber-800/30 rounded-lg px-3 py-2 text-xs">
              <AlertCircle size={12} className="shrink-0" />
              <span>Connect to OpenCode server first.</span>
            </div>
          )}

          {/* ── Prompt input ───────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-[11px] font-medium">
              Describe your workflow
            </Label>
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. A multi-agent code review workflow…"
              className="min-h-[80px] bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-600 resize-none text-xs focus:border-violet-500/50 focus:ring-violet-500/20"
              disabled={isStreaming}
            />
            <p className="text-[10px] text-zinc-600">
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[9px]">Ctrl+Enter</kbd> to generate
            </p>
          </div>

          {/* ── Example prompts ────────────────────────────────── */}
          {!isStreaming && !isDone && (
            <div className="space-y-1.5">
              <Label className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">
                Examples
              </Label>
              <div className="grid grid-cols-1 gap-1">
                {EXAMPLE_PROMPTS.map((example, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleExampleClick(example)}
                    className="text-left text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg px-2.5 py-1.5 transition-colors border border-transparent hover:border-zinc-700/50"
                  >
                    <Zap size={9} className="inline mr-1 text-violet-500/60" />
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Model selector ─────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-[11px] font-medium">Model</Label>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!isConnected || modelsLoading || isStreaming}
                className="w-full h-8 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-xs text-zinc-200 px-2.5 pr-7 appearance-none focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!isConnected && <option value="">Not connected</option>}
                {isConnected && modelsLoading && <option value="">Loading models…</option>}
                {isConnected && !modelsLoading && groups.length === 0 && (
                  <option value="">No models available</option>
                )}
                {groups.map((group, idx) => (
                  <optgroup key={`${group.providerId}-${idx}`} label={group.label}>
                    {group.models.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.displayName}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
              />
            </div>
          </div>

          {/* ── Streaming progress ─────────────────────────────── */}
          {(isStreaming || isDone || isError) && (
            <div
              className={cn(
                "rounded-lg border p-3 space-y-2",
                isStreaming && "border-violet-700/30 bg-violet-950/10",
                isDone && "border-emerald-700/30 bg-emerald-950/10",
                isError && "border-red-700/30 bg-red-950/10",
              )}
            >
              {/* Status line */}
              <div className="flex items-center gap-2">
                {isStreaming && (
                  <>
                    <Loader2 size={12} className="text-violet-400 animate-spin" />
                    <span className="text-xs text-violet-300">
                      {status === "creating-session"
                        ? "Creating AI session…"
                        : "Streaming nodes to canvas…"}
                    </span>
                  </>
                )}
                {isDone && (
                  <>
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span className="text-xs text-emerald-300">
                      Workflow generated!
                    </span>
                  </>
                )}
                {isError && (
                  <>
                    <XCircle size={12} className="text-red-400" />
                    <span className="text-xs text-red-300">Generation failed</span>
                  </>
                )}
              </div>

              {/* Stats */}
              {(isStreaming || isDone) && (
                <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Workflow size={10} />
                    {parsedNodeCount} nodes
                  </span>
                  <span>{parsedEdgeCount} edges</span>
                  <span>~{tokenCount} tokens</span>
                </div>
              )}

              {/* Error message */}
              {isError && error && (
                <p className="text-[10px] text-red-400/80 bg-red-950/20 rounded px-2 py-1 font-mono break-all">
                  {error}
                </p>
              )}

              {/* Raw JSON preview (dev only) */}
              {process.env.NODE_ENV === "development" &&
                isStreaming &&
                streamedText && (
                  <details className="group">
                    <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-400 select-none">
                      Show raw output…
                    </summary>
                    <pre className="mt-1.5 text-[9px] text-zinc-600 bg-zinc-950/50 rounded p-1.5 max-h-24 overflow-auto font-mono whitespace-pre-wrap break-all">
                      {streamedText.slice(-1500)}
                    </pre>
                  </details>
                )}
            </div>
          )}

          {/* ── Actions ────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="text-[10px] text-zinc-600">
              {isConnected ? "Connected" : "Not connected"}
            </div>
            <div className="flex items-center gap-1.5">
              {isStreaming && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancel}
                  className="text-zinc-400 hover:text-zinc-200 gap-1 h-7 text-xs px-2"
                >
                  <StopCircle size={12} />
                  Cancel
                </Button>
              )}
              {(isError || isDone) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="text-zinc-400 hover:text-zinc-200 gap-1 h-7 text-xs px-2"
                >
                  <RotateCcw size={12} />
                  {isDone ? "New" : "Retry"}
                </Button>
              )}
              {!isStreaming && !isDone && (
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={!isConnected || !prompt.trim() || !selectedModel}
                  className="bg-violet-600 hover:bg-violet-500 text-white gap-1 h-7 text-xs px-3 shadow-sm disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  Generate
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

