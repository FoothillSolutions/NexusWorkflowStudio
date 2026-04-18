"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import UnsavedChangesDialog from "./unsaved-changes-dialog";
import { FloatingWorkflowGenActionsRow } from "./floating-workflow-gen/actions-row";
import { FloatingWorkflowGenCollapsedStatus } from "./floating-workflow-gen/collapsed-status";
import {
  TEXTAREA_FOCUS_DELAY_MS,
  VISIBLE_EXAMPLE_COUNT,
} from "./floating-workflow-gen/constants";
import { FloatingWorkflowGenExamplesSection } from "./floating-workflow-gen/examples-section";
import { FloatingWorkflowGenHeader } from "./floating-workflow-gen/header";
import { FloatingWorkflowGenProjectContextToggle } from "./floating-workflow-gen/project-context-toggle";
import { FloatingWorkflowGenStatusPanel } from "./floating-workflow-gen/status-panel";
import { useFloatingWorkflowGenPosition } from "./floating-workflow-gen/use-floating-workflow-gen-position";
import { useWorkflowGenStore } from "@/store/workflow-gen";
import { useOpenCodeStore } from "@/store/opencode";
import { useWorkflowStore } from "@/store/workflow";
import { useModels } from "@/hooks/use-models";
import { ModelSelect } from "@/nodes/shared/model-select";
import { toast } from "sonner";


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

  // AI-generated examples
  const aiExamples = useWorkflowGenStore((s) => s.aiExamples);
  const aiExamplesStatus = useWorkflowGenStore((s) => s.aiExamplesStatus);
  const fetchAiExamples = useWorkflowGenStore((s) => s.fetchAiExamples);

  // Project folder context
  const useProjectContext = useWorkflowGenStore((s) => s.useProjectContext);
  const projectContextStatus = useWorkflowGenStore((s) => s.projectContextStatus);
  const setUseProjectContext = useWorkflowGenStore((s) => s.setUseProjectContext);
  const fetchProjectContext = useWorkflowGenStore((s) => s.fetchProjectContext);

  const connectionStatus = useOpenCodeStore((s) => s.status);
  const isConnected = connectionStatus === "connected";
  const currentProject = useOpenCodeStore((s) => s.currentProject);
  const needsSave = useWorkflowStore((s) => s.needsSave);

  const { groups } = useModels();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);

  const isStreaming = status === "streaming" || status === "creating-session";
  const isDone = status === "done";
  const isError = status === "error";
  const { panelRef, handleDragStart, resetPosition, panelStyle } = useFloatingWorkflowGenPosition({
    floating,
    collapsed,
  });

  // Fetch AI examples when panel opens with a model selected
  useEffect(() => {
    if (floating && isConnected && selectedModel && aiExamplesStatus === "idle") {
      fetchAiExamples();
    }
  }, [floating, isConnected, selectedModel, aiExamplesStatus, fetchAiExamples]);

  // Re-fetch project context when the project changes while toggle is on
  useEffect(() => {
    if (floating && isConnected && useProjectContext && currentProject) {
      useWorkflowGenStore.setState({ projectContextStatus: "idle", projectContext: null });
      fetchProjectContext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.worktree]);

  // When project context finishes loading, fetch context-aware examples
  // and prepend them to the existing ones (no clearing, no shimmers).
  const prevContextKeyRef = useRef<string>("");
  useEffect(() => {
    const key = useProjectContext ? `on:${projectContextStatus}` : "off";
    const prev = prevContextKeyRef.current;
    prevContextKeyRef.current = key;

    // Skip the initial render
    if (!prev) return;

    if (floating && isConnected && selectedModel) {
      // Context just finished loading → fetch project-aware examples and prepend
      if (useProjectContext && projectContextStatus === "done" && prev !== key) {
        // Reset session so the new fetch uses project context in its prompt
        useWorkflowGenStore.setState({ aiExamplesStatus: "idle", _examplesSessionId: null });
        fetchAiExamples({ prepend: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useProjectContext, projectContextStatus]);

  // ── AI examples (no rotation — just show the first N) ──────
  const visibleExamples = useMemo(
    () => aiExamples.slice(0, VISIBLE_EXAMPLE_COUNT),
    [aiExamples],
  );

  const showShimmers = visibleExamples.length === 0 && (aiExamplesStatus === "loading" || aiExamplesStatus === "idle");
  const currentProjectName = currentProject?.worktree.split(/[/\\]/).pop() ?? null;

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
      setTimeout(() => textareaRef.current?.focus(), TEXTAREA_FOCUS_DELAY_MS);
    }
  }, [floating, collapsed]);

  const runGenerate = useCallback(async () => {
    // Auto-collapse when generation starts so the user sees the canvas
    useWorkflowGenStore.setState({ collapsed: true });
    await generate();
    const newStatus = useWorkflowGenStore.getState().status;
    if (newStatus === "done") {
      toast.success("Workflow generated successfully!");
    }
  }, [generate]);

  const handleGenerate = useCallback(async () => {
    if (needsSave) {
      setConfirmGenerateOpen(true);
      return;
    }

    await runGenerate();
  }, [needsSave, runGenerate]);

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
      ref={panelRef}
      className={cn(
        "absolute z-40 flex flex-col rounded-2xl border bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden",
        "animate-in slide-in-from-top-4 fade-in-0 duration-200",
        "border-violet-700/30",
      )}
      style={panelStyle}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <FloatingWorkflowGenHeader
        collapsed={collapsed}
        isStreaming={isStreaming}
        isDone={isDone}
        tokenCount={tokenCount}
        parsedNodeCount={parsedNodeCount}
        onToggleCollapsed={() => {
          toggleCollapsed();
          requestAnimationFrame(() => resetPosition());
        }}
        onClose={handleClose}
        onDragStart={handleDragStart}
      />

      <UnsavedChangesDialog
        open={confirmGenerateOpen}
        onOpenChange={setConfirmGenerateOpen}
        title="Generate a new workflow with AI?"
        description="Your current workflow has unsaved work. Generating with AI will replace the current canvas."
        confirmLabel="Generate Anyway"
        onConfirm={() => {
          void runGenerate();
        }}
      />

      {/* ── Collapsed status bar ──────────────────────────────────── */}
      {collapsed && (
        <FloatingWorkflowGenCollapsedStatus
          isStreaming={isStreaming}
          isDone={isDone}
          isError={isError}
          tokenCount={tokenCount}
          parsedNodeCount={parsedNodeCount}
        />
      )}

      {/* ── Body (hidden when collapsed) ──────────────────────────── */}
      {!collapsed && (
        <>
          {/* ── Model selector (outside scroll area so dropdown isn't clipped) ── */}
          <div className="px-3.5 pt-3.5 pb-0 space-y-1.5 shrink-0">
            <Label className="text-zinc-400 text-[11px] font-medium">Model</Label>
            <ModelSelect
              value={selectedModel}
              onChange={setSelectedModel}
              hideInherit
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-3.5 pb-3.5 pt-3.5 space-y-3.5">
          {/* ── Connection warning ──────────────────────────────── */}
          {!isConnected && (
            <div className="flex items-center gap-2 text-amber-400 bg-amber-950/20 border border-amber-800/30 rounded-lg px-3 py-2 text-xs">
              <AlertCircle size={12} className="shrink-0" />
              <span>Connect to OpenCode server first.</span>
            </div>
          )}

          {/* ── Project folder context toggle ──────────────────── */}
          {isConnected && (
            <FloatingWorkflowGenProjectContextToggle
              isStreaming={isStreaming}
              useProjectContext={useProjectContext}
              projectContextStatus={projectContextStatus}
              currentProjectName={currentProjectName}
              onToggle={() => {
                const next = !useProjectContext;
                setUseProjectContext(next);
                if (next && projectContextStatus === "idle") {
                  fetchProjectContext();
                }
              }}
              onRetry={() => fetchProjectContext()}
            />
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
              className="min-h-20 bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-600 resize-none text-xs focus:border-violet-500/50 focus:ring-violet-500/20"
              disabled={isStreaming}
            />
            <p className="text-[10px] text-zinc-600">
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[9px]">Ctrl+Enter</kbd> to generate
            </p>
          </div>

          {/* ── Example prompts ────────────────────────────────── */}
          {!isStreaming && !isDone && (
            <FloatingWorkflowGenExamplesSection
              visibleExamples={visibleExamples}
              showShimmers={showShimmers}
              aiExamplesStatus={aiExamplesStatus}
              hasRefresh={isConnected && aiExamplesStatus === "done" && aiExamples.length > 0}
              onRefresh={() => {
                useWorkflowGenStore.setState({ aiExamples: [], aiExamplesStatus: "idle", _examplesSessionId: null });
                fetchAiExamples();
              }}
              onExampleClick={handleExampleClick}
            />
          )}

          {/* ── Streaming progress ─────────────────────────────── */}
          {(isStreaming || isDone || isError) && (
            <FloatingWorkflowGenStatusPanel
              isStreaming={isStreaming}
              isDone={isDone}
              isError={isError}
              status={status}
              parsedNodeCount={parsedNodeCount}
              tokenCount={tokenCount}
              error={error}
              streamedText={streamedText}
            />
          )}

          {/* ── Actions ────────────────────────────────────────── */}
          <FloatingWorkflowGenActionsRow
            isConnected={isConnected}
            isStreaming={isStreaming}
            isDone={isDone}
            isError={isError}
            canGenerate={isConnected && Boolean(prompt.trim()) && Boolean(selectedModel)}
            onCancel={cancel}
            onReset={reset}
            onGenerate={handleGenerate}
          />
        </div>
        </>
      )}
    </div>
  );
}

