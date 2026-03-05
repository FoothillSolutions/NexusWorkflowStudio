"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Workflow,
  Zap,
  StopCircle,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowGenStore } from "@/store/workflow-gen-store";
import { useOpenCodeStore } from "@/store/opencode-store";
import { useModels } from "@/hooks/use-models";
import { toast } from "sonner";

// ── Example prompts for inspiration ──────────────────────────────────────────
const EXAMPLE_PROMPTS = [
  "A code review workflow with an agent that analyzes PRs, checks for issues using if-else branching, and provides feedback",
  "A customer support workflow with an ask-user node to classify the issue, then routes to different specialist agents via a switch node",
  "A content generation pipeline with a research agent, writing agent with connected skills for SEO and tone, and an editor agent",
  "A data processing workflow that validates input, transforms data through multiple agents, and handles errors with if-else",
];

export default function WorkflowGenDialog() {
  const open = useWorkflowGenStore((s) => s.open);
  const status = useWorkflowGenStore((s) => s.status);
  const prompt = useWorkflowGenStore((s) => s.prompt);
  const selectedModel = useWorkflowGenStore((s) => s.selectedModel);
  const parsedNodeCount = useWorkflowGenStore((s) => s.parsedNodeCount);
  const parsedEdgeCount = useWorkflowGenStore((s) => s.parsedEdgeCount);
  const tokenCount = useWorkflowGenStore((s) => s.tokenCount);
  const error = useWorkflowGenStore((s) => s.error);
  const streamedText = useWorkflowGenStore((s) => s.streamedText);

  const setOpen = useWorkflowGenStore((s) => s.setOpen);
  const setPrompt = useWorkflowGenStore((s) => s.setPrompt);
  const setSelectedModel = useWorkflowGenStore((s) => s.setSelectedModel);
  const generate = useWorkflowGenStore((s) => s.generate);
  const cancel = useWorkflowGenStore((s) => s.cancel);
  const reset = useWorkflowGenStore((s) => s.reset);

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

  // Focus textarea when dialog opens
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const handleGenerate = useCallback(async () => {
    await generate();
    const newStatus = useWorkflowGenStore.getState().status;
    if (newStatus === "done") {
      toast.success("Workflow generated successfully!");
      setOpen(false);
      reset();
    }
  }, [generate, setOpen, reset]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isStreaming) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate, isStreaming],
  );

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isStreaming) {
        cancel();
      }
      if (!nextOpen) {
        reset();
      }
      setOpen(nextOpen);
    },
    [isStreaming, cancel, reset, setOpen],
  );

  const handleExampleClick = useCallback(
    (example: string) => {
      setPrompt(example);
      textareaRef.current?.focus();
    },
    [setPrompt],
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-800 p-0 overflow-hidden gap-0 max-h-[90vh]">
        {/* ── Hero header ──────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-violet-950/40 via-zinc-900 to-zinc-900 px-6 pt-6 pb-4 border-b border-zinc-800/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-zinc-100">
              <div className="h-8 w-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Sparkles size={16} className="text-violet-400" />
              </div>
              Generate Workflow with AI
            </DialogTitle>
            <DialogDescription className="text-zinc-400 mt-1.5">
              Describe the workflow you want to create in natural language. The AI will generate
              a complete workflow with nodes, edges, and configurations.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          {/* ── Connection warning ────────────────────────────────── */}
          {!isConnected && (
            <div className="flex items-center gap-2 text-amber-400 bg-amber-950/20 border border-amber-800/30 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle size={14} className="shrink-0" />
              <span>Connect to an OpenCode server first to use AI generation.</span>
            </div>
          )}

          {/* ── Prompt input ─────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm font-medium">
              Describe your workflow
            </Label>
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. A multi-agent code review workflow that analyzes pull requests, checks for security issues, runs linting, and provides a summary..."
              className="min-h-[120px] bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-600 resize-none focus:border-violet-500/50 focus:ring-violet-500/20"
              disabled={isStreaming}
            />
            <p className="text-[11px] text-zinc-600">
              Press <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[10px]">Ctrl+Enter</kbd> to generate
            </p>
          </div>

          {/* ── Example prompts ──────────────────────────────────── */}
          {!isStreaming && !isDone && (
            <div className="space-y-2">
              <Label className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
                Examples
              </Label>
              <div className="grid grid-cols-1 gap-1.5">
                {EXAMPLE_PROMPTS.map((example, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleExampleClick(example)}
                    className="text-left text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg px-3 py-2 transition-colors border border-transparent hover:border-zinc-700/50"
                  >
                    <Zap size={10} className="inline mr-1.5 text-violet-500/60" />
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Model selector ───────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm font-medium">Model</Label>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!isConnected || modelsLoading || isStreaming}
                className="w-full h-9 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 px-3 pr-8 appearance-none focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
              />
            </div>
          </div>

          {/* ── Streaming progress ───────────────────────────────── */}
          {(isStreaming || isDone || isError) && (
            <div className={cn(
              "rounded-lg border p-4 space-y-3",
              isStreaming && "border-violet-700/30 bg-violet-950/10",
              isDone && "border-emerald-700/30 bg-emerald-950/10",
              isError && "border-red-700/30 bg-red-950/10",
            )}>
              {/* Status line */}
              <div className="flex items-center gap-2">
                {isStreaming && (
                  <>
                    <Loader2 size={14} className="text-violet-400 animate-spin" />
                    <span className="text-sm text-violet-300">
                      {status === "creating-session" ? "Creating AI session…" : "Generating workflow…"}
                    </span>
                  </>
                )}
                {isDone && (
                  <>
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span className="text-sm text-emerald-300">Workflow generated successfully!</span>
                  </>
                )}
                {isError && (
                  <>
                    <XCircle size={14} className="text-red-400" />
                    <span className="text-sm text-red-300">Generation failed</span>
                  </>
                )}
              </div>

              {/* Stats */}
              {(isStreaming || isDone) && (
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Workflow size={11} />
                    {parsedNodeCount} nodes
                  </span>
                  <span>{parsedEdgeCount} edges</span>
                  <span>~{tokenCount} tokens</span>
                </div>
              )}

              {/* Error message */}
              {isError && error && (
                <p className="text-xs text-red-400/80 bg-red-950/20 rounded px-2 py-1.5 font-mono break-all">
                  {error}
                </p>
              )}

              {/* Raw JSON preview (dev only) */}
              {process.env.NODE_ENV === "development" && isStreaming && streamedText && (
                <details className="group">
                  <summary className="text-[11px] text-zinc-600 cursor-pointer hover:text-zinc-400 select-none">
                    Show raw output…
                  </summary>
                  <pre className="mt-2 text-[10px] text-zinc-600 bg-zinc-950/50 rounded p-2 max-h-32 overflow-auto font-mono whitespace-pre-wrap break-all">
                    {streamedText.slice(-2000)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        {/* ── Footer actions ────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-zinc-800/50 bg-zinc-900/50 flex items-center justify-between gap-3">
          <div className="text-[11px] text-zinc-600">
            {isConnected ? "Connected to OpenCode" : "Not connected"}
          </div>
          <div className="flex items-center gap-2">
            {isStreaming && (
              <Button
                variant="ghost"
                size="sm"
                onClick={cancel}
                className="text-zinc-400 hover:text-zinc-200 gap-1.5"
              >
                <StopCircle size={14} />
                Cancel
              </Button>
            )}
            {(isError || isDone) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="text-zinc-400 hover:text-zinc-200 gap-1.5"
              >
                <RotateCcw size={14} />
                {isDone ? "Generate Another" : "Try Again"}
              </Button>
            )}
            {!isStreaming && !isDone && (
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={!isConnected || !prompt.trim() || !selectedModel}
                className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5 px-4 shadow-sm disabled:opacity-50"
              >
                <Sparkles size={14} />
                Generate Workflow
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

