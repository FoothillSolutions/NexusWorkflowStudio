"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { AlertCircle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import UnsavedChangesDialog from "./unsaved-changes-dialog";
import { FloatingWorkflowGenActionsRow } from "./floating-workflow-gen/actions-row";
import { FloatingWorkflowGenCollapsedStatus } from "./floating-workflow-gen/collapsed-status";
import { FloatingWorkflowGenSuggestionsSection } from "./floating-workflow-gen/suggestions-section";
import {
  TEXTAREA_FOCUS_DELAY_MS,
  VISIBLE_EXAMPLE_COUNT,
} from "./floating-workflow-gen/constants";
import { FloatingWorkflowGenExamplesSection } from "./floating-workflow-gen/examples-section";
import { FloatingWorkflowGenHeader } from "./floating-workflow-gen/header";
import { FloatingWorkflowGenModeToggle } from "./floating-workflow-gen/mode-toggle";
import { FloatingWorkflowGenProjectContextToggle } from "./floating-workflow-gen/project-context-toggle";
import { FloatingWorkflowGenStatusPanel } from "./floating-workflow-gen/status-panel";
import { useFloatingWorkflowGenPosition } from "./floating-workflow-gen/use-floating-workflow-gen-position";
import { useWorkflowGenStore } from "@/store/workflow-gen";
import { useOpenCodeStore } from "@/store/opencode";
import { useWorkflowStore } from "@/store/workflow";
import { useModels } from "@/hooks/use-models";
import { ModelSelect } from "@/nodes/shared/model-select";
import { WorkflowNodeType } from "@/types/workflow";
import { toast } from "sonner";


// ── Component ────────────────────────────────────────────────────────────────
// Floating panel for AI workflow generation, positioned top-center under the header.
// Replaces the old modal dialog approach so nodes stream onto the canvas in real-time.

export default function FloatingWorkflowGen() {
  const floating = useWorkflowGenStore((s) => s.floating);
  const collapsed = useWorkflowGenStore((s) => s.collapsed);
  const status = useWorkflowGenStore((s) => s.status);
  const mode = useWorkflowGenStore((s) => s.mode);
  const prompt = useWorkflowGenStore((s) => s.prompt);
  const selectedModel = useWorkflowGenStore((s) => s.selectedModel);
  const parsedNodeCount = useWorkflowGenStore((s) => s.parsedNodeCount);
  const error = useWorkflowGenStore((s) => s.error);
  const streamedText = useWorkflowGenStore((s) => s.streamedText);

  const setPrompt = useWorkflowGenStore((s) => s.setPrompt);
  const setSelectedModel = useWorkflowGenStore((s) => s.setSelectedModel);
  const setMode = useWorkflowGenStore((s) => s.setMode);
  const generate = useWorkflowGenStore((s) => s.generate);
  const cancel = useWorkflowGenStore((s) => s.cancel);
  const reset = useWorkflowGenStore((s) => s.reset);
  const close = useWorkflowGenStore((s) => s.close);
  const toggleCollapsed = useWorkflowGenStore((s) => s.toggleCollapsed);
  const openSuggestions = useWorkflowGenStore((s) => s.openSuggestions);
  const suggestionsOpen = useWorkflowGenStore((s) => s.suggestionsOpen);

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
  const workflowNodes = useWorkflowStore((s) => s.nodes);
  const workflowEdges = useWorkflowStore((s) => s.edges);

  // The canvas has "user content" when it holds anything beyond the default
  // start + end pair (or any edges). Edit mode is only useful in that case.
  const hasContent = useMemo(() => {
    const hasExtraNode = workflowNodes.some(
      (n) => n.data?.type !== WorkflowNodeType.Start && n.data?.type !== WorkflowNodeType.End,
    );
    return hasExtraNode || workflowEdges.length > 0;
  }, [workflowNodes, workflowEdges]);

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

  // If the panel opens on an empty canvas while Edit is selected, snap back
  // to Generate. We do NOT auto-flip to Edit when content appears.
  useEffect(() => {
    if (floating && !hasContent && mode === "edit") {
      setMode("generate");
    }
  }, [floating, hasContent, mode, setMode]);

  const runGenerate = useCallback(async () => {
    // Auto-collapse when generation starts so the user sees the canvas
    useWorkflowGenStore.setState({ collapsed: true });
    const startingMode = useWorkflowGenStore.getState().mode;
    await generate();
    const newStatus = useWorkflowGenStore.getState().status;
    if (newStatus === "done") {
      toast.success(
        startingMode === "edit"
          ? "Workflow edited successfully!"
          : "Workflow generated successfully!",
      );
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
        parsedNodeCount={parsedNodeCount}
        mode={mode}
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
        title={
          mode === "edit"
            ? "Edit current workflow with AI?"
            : "Generate a new workflow with AI?"
        }
        description={
          mode === "edit"
            ? "Your current workflow has unsaved changes. The AI will return an updated version that replaces the canvas atomically."
            : "Your current workflow has unsaved work. Generating with AI will replace the current canvas."
        }
        confirmLabel={mode === "edit" ? "Edit Anyway" : "Generate Anyway"}
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
          parsedNodeCount={parsedNodeCount}
          mode={mode}
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
              <span>Connect to the ACP bridge or an OpenCode server first.</span>
            </div>
          )}

          {suggestionsOpen ? (
            <FloatingWorkflowGenSuggestionsSection />
          ) : (
            <>
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

              {/* ── Mode toggle (Generate / Edit) ──────────────────── */}
              <FloatingWorkflowGenModeToggle
                mode={mode}
                onChange={setMode}
                disabled={isStreaming}
                editDisabled={!hasContent}
                editDisabledReason="Add or load a workflow to enable Edit"
              />

              {/* ── Suggest Enhancements (AI-powered review of current workflow) ── */}
              {isConnected && hasContent && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={openSuggestions}
                      disabled={isStreaming}
                      className="group w-full justify-start gap-2 rounded-lg border border-violet-700/25 bg-violet-500/5 px-3 py-2 h-auto text-xs text-violet-200/90 hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-100 disabled:opacity-40"
                    >
                      <Lightbulb className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                      <div className="flex flex-col items-start gap-0.5 min-w-0">
                        <span className="font-medium leading-none">Suggest Enhancements</span>
                        <span className="text-[10px] text-violet-300/60 leading-none">
                          Review this workflow and propose improvements
                        </span>
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    AI analyzes your current workflow and proposes concrete enhancements you can apply with one click.
                  </TooltipContent>
                </Tooltip>
              )}

              {/* ── Prompt input ───────────────────────────────────── */}
              <div className="space-y-1.5">
                <Label className="text-zinc-400 text-[11px] font-medium">
                  {mode === "edit" ? "Describe your change" : "Describe your workflow"}
                </Label>
                <Textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    mode === "edit"
                      ? "e.g. Add a skill node that connects to the reviewer agent…"
                      : "e.g. A multi-agent code review workflow…"
                  }
                  className="min-h-20 bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-600 resize-none text-xs focus:border-violet-500/50 focus:ring-violet-500/20"
                  disabled={isStreaming}
                />
                <p className="text-[10px] text-zinc-600">
                  <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[9px]">Ctrl+Enter</kbd>
                  {mode === "edit" ? " to edit" : " to generate"}
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
                mode={mode}
                onCancel={cancel}
                onReset={reset}
                onGenerate={handleGenerate}
              />
            </>
          )}
        </div>
        </>
      )}
    </div>
  );
}

