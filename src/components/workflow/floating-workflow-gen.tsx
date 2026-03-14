"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
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
  StopCircle,
  RotateCcw,
  BotMessageSquare,
  RefreshCw,
  FolderOpen,
  GripHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import UnsavedChangesDialog from "./unsaved-changes-dialog";
import { useWorkflowGenStore } from "@/store/workflow-gen-store";
import { useOpenCodeStore } from "@/store/opencode-store";
import { useWorkflowStore } from "@/store/workflow-store";
import { useModels } from "@/hooks/use-models";
import { ModelSelect } from "@/nodes/shared/model-select";
import { toast } from "sonner";

/** Number of AI examples shown at a time */
const VISIBLE_EXAMPLE_COUNT = 3;
const PANEL_TOP_OFFSET = 12;
const VIEWPORT_PADDING = 16;

/**
 * Fixed height for each example row (in px).
 * 3 lines of 11px text ≈ ~16px line-height × 3 = 48px + 12px padding = 60px.
 * Using a fixed height prevents the container from jumping when examples change.
 */
const EXAMPLE_ROW_HEIGHT = 54;

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
  const panelRef = useRef<HTMLDivElement>(null);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);

  const isStreaming = status === "streaming" || status === "creating-session";
  const isDone = status === "done";
  const isError = status === "error";

  // ── Drag ────────────────────────────────────────────────────
  // Pure ref-based drag with a single `translate3d` (GPU layer, no layout, no calc).
  // We store the absolute top-left position so the transform is always a plain px value.
  const posRef = useRef({ x: 0, y: 0 });       // current absolute top-left offset from initial center
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const rafId = useRef(0);

  const getViewportSize = useCallback(() => {
    if (typeof window === "undefined") {
      return { width: 0, height: 0 };
    }

    const vv = window.visualViewport;
    return {
      width: vv?.width ?? window.innerWidth,
      height: vv?.height ?? window.innerHeight,
    };
  }, []);

  const clampPosition = useCallback((pos: { x: number; y: number }) => {
    const el = panelRef.current;
    if (!el) return pos;

    const { width: viewportWidth, height: viewportHeight } = getViewportSize();
    const panelWidth = el.offsetWidth;
    const panelHeight = el.offsetHeight;

    const halfHorizontalTravel = Math.max((viewportWidth - panelWidth) / 2 - VIEWPORT_PADDING, 0);
    const minX = -halfHorizontalTravel;
    const maxX = halfHorizontalTravel;

    const minY = VIEWPORT_PADDING - PANEL_TOP_OFFSET;
    const maxY = Math.max(minY, viewportHeight - panelHeight - VIEWPORT_PADDING - PANEL_TOP_OFFSET);

    return {
      x: Math.min(Math.max(pos.x, minX), maxX),
      y: Math.min(Math.max(pos.y, minY), maxY),
    };
  }, [getViewportSize]);

  /** Write the current posRef to the DOM in a single translate3d (GPU-composited). */
  const flush = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    const next = clampPosition(posRef.current);
    posRef.current = next;
    const { x, y } = next;
    // translate3d promotes to its own compositor layer → zero layout cost
    el.style.transform = `translate3d(calc(-50% + ${x}px), ${y}px, 0)`;
  }, [clampPosition]);

  /** Snap back to center with a short CSS transition. */
  const resetPosition = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    // If already at origin, nothing to animate
    if (posRef.current.x === 0 && posRef.current.y === 0) return;
    posRef.current = clampPosition({ x: 0, y: 0 });
    el.style.transition = "transform 0.2s cubic-bezier(.4,0,.2,1)";
    const { x, y } = posRef.current;
    el.style.transform = `translate3d(calc(-50% + ${x}px), ${y}px, 0)`;
    const cleanup = () => { el.style.transition = ""; el.removeEventListener("transitionend", cleanup); };
    el.addEventListener("transitionend", cleanup);
    // Fallback: if transitionend never fires (e.g. already at target), clean up after 250ms
    setTimeout(cleanup, 250);
  }, [clampPosition]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.stopPropagation();

    const el = panelRef.current;
    if (el) el.style.transition = "";           // kill any reset transition in progress

    const { x, y } = posRef.current;
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: x, oy: y };
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      posRef.current = clampPosition({
        x: dragStart.current.ox + (ev.clientX - dragStart.current.mx),
        y: dragStart.current.oy + (ev.clientY - dragStart.current.my),
      });
      // Coalesce to the next frame — at most one DOM write per paint
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(flush);
    };

    const onUp = () => {
      document.body.style.userSelect = "";
      cancelAnimationFrame(rafId.current);
      flush();                                   // final position commit
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseup", onUp, true);
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseup", onUp, true);
  }, [clampPosition, flush]);

  // Reset position whenever the panel opens or closes so it always starts centered
  useEffect(() => {
    posRef.current = { x: 0, y: 0 };
    const el = panelRef.current;
    if (el) {
      el.style.transition = "";
      requestAnimationFrame(() => {
        posRef.current = clampPosition({ x: 0, y: 0 });
        flush();
      });
    }
  }, [clampPosition, flush, floating]);

  useEffect(() => {
    if (!floating) return;

    requestAnimationFrame(flush);
  }, [collapsed, flush, floating]);

  useEffect(() => {
    if (!floating) return;

    const handleResize = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(flush);
    };

    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      cancelAnimationFrame(rafId.current);
    };
  }, [flush, floating]);

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
      style={{
        top: PANEL_TOP_OFFSET,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(520px, calc(100dvw - 32px))",
        maxHeight: collapsed ? undefined : "calc(100dvh - 140px)",
        willChange: "transform",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* ── Header (draggable) ──────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 border-b shrink-0 bg-violet-950/30 border-violet-800/20 rounded-t-2xl cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleDragStart}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal size={14} className="text-zinc-600 shrink-0" />
          <Sparkles size={14} className="text-violet-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              Generate Workflow with AI
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 leading-none">
                Beta
              </span>
            </span>
            {isStreaming && (
              <span className="text-[10px] text-violet-400/80 block">
                ~{tokenCount} tokens · {parsedNodeCount} nodes
              </span>
            )}
            {isDone && (
              <span className="text-[10px] text-emerald-400/80 block">
                ~{tokenCount} tokens · {parsedNodeCount} nodes
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Collapse / expand toggle — also resets position */}
          <button
            type="button"
            onClick={() => {
              toggleCollapsed();
              // Defer reset to next frame so the collapse re-render settles first
              requestAnimationFrame(() => resetPosition());
            }}
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
        <div className="px-3.5 py-2 flex items-center gap-2 text-[11px] text-zinc-400">
          {isStreaming ? (
            <>
              <Loader2 size={11} className="text-violet-400 animate-spin" />
              Generating… ~{tokenCount} tokens · {parsedNodeCount} nodes
            </>
          ) : isDone ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Complete — ~{tokenCount} tokens · {parsedNodeCount} nodes
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

          <div className="flex-1 overflow-y-auto min-h-0 px-3.5 pb-3.5 pt-3.5 space-y-3.5">
          {/* ── Connection warning ──────────────────────────────── */}
          {!isConnected && (
            <div className="flex items-center gap-2 text-amber-400 bg-amber-950/20 border border-amber-800/30 rounded-lg px-3 py-2 text-xs">
              <AlertCircle size={12} className="shrink-0" />
              <span>Connect to OpenCode server first.</span>
            </div>
          )}

          {/* ── Project folder context toggle ──────────────────── */}
          {isConnected && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  const next = !useProjectContext;
                  setUseProjectContext(next);
                  if (next && projectContextStatus === "idle") {
                    fetchProjectContext();
                  }
                }}
                disabled={isStreaming}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-all border",
                  useProjectContext
                    ? "bg-violet-950/30 border-violet-700/40 text-violet-300"
                    : "bg-zinc-800/30 border-zinc-700/30 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600/40",
                  isStreaming && "opacity-50 cursor-not-allowed",
                )}
              >
                <FolderOpen size={13} className={cn(
                  "shrink-0 transition-colors",
                  useProjectContext ? "text-violet-400" : "text-zinc-600",
                )} />
                <div className="flex-1 min-w-0 text-left">
                  <span className="font-medium">
                    Use project folder as context
                  </span>
                  {currentProject && (
                    <span className={cn(
                      "ml-1.5 text-[10px]",
                      useProjectContext ? "text-violet-400/60" : "text-zinc-600",
                    )}>
                      {currentProject.worktree.split(/[/\\]/).pop()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {useProjectContext && projectContextStatus === "loading" && (
                    <Loader2 size={10} className="text-violet-400 animate-spin" />
                  )}
                  {useProjectContext && projectContextStatus === "done" && (
                    <CheckCircle2 size={10} className="text-emerald-400" />
                  )}
                  {useProjectContext && projectContextStatus === "error" && (
                    <XCircle size={10} className="text-red-400" />
                  )}
                  {/* Toggle indicator */}
                  <div className={cn(
                    "w-7 h-4 rounded-full transition-colors relative",
                    useProjectContext ? "bg-violet-600" : "bg-zinc-700",
                  )}>
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                      useProjectContext ? "left-3.5" : "left-0.5",
                    )} />
                  </div>
                </div>
              </button>
              {useProjectContext && projectContextStatus === "error" && (
                <button
                  type="button"
                  onClick={() => fetchProjectContext()}
                  className="text-[10px] text-red-400/70 hover:text-red-300 transition-colors flex items-center gap-1 px-2.5"
                >
                  <RefreshCw size={8} />
                  Failed to load file tree — click to retry
                </button>
              )}
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
              className="min-h-20 bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-600 resize-none text-xs focus:border-violet-500/50 focus:ring-violet-500/20"
              disabled={isStreaming}
            />
            <p className="text-[10px] text-zinc-600">
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[9px]">Ctrl+Enter</kbd> to generate
            </p>
          </div>

          {/* ── Example prompts ────────────────────────────────── */}
          {!isStreaming && !isDone && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider flex items-center gap-1.5">
                  Examples
                  {aiExamplesStatus === "loading" && (
                    <Loader2 size={9} className="text-violet-400 animate-spin" />
                  )}
                </Label>
                {isConnected && aiExamplesStatus === "done" && aiExamples.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      useWorkflowGenStore.setState({ aiExamples: [], aiExamplesStatus: "idle", _examplesSessionId: null });
                      fetchAiExamples();
                    }}
                    className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-violet-400 transition-colors"
                    title="Generate new AI examples"
                  >
                    <RefreshCw size={9} />
                    Refresh
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-1">
                {/* Shimmer placeholders */}
                {showShimmers && (
                  Array.from({ length: VISIBLE_EXAMPLE_COUNT }).map((_, i) => (
                    <div
                      key={`shimmer-${i}`}
                      className="rounded-lg px-2.5 border border-zinc-800/40 overflow-hidden"
                      style={{ height: EXAMPLE_ROW_HEIGHT }}
                    >
                      <div className="flex flex-col justify-center gap-1.5 h-full">
                        <div
                          className="h-2.5 rounded-md bg-linear-to-r from-zinc-800/60 via-zinc-700/30 to-zinc-800/60 animate-shimmer"
                          style={{ width: `${85 - i * 10}%`, backgroundSize: "200% 100%" }}
                        />
                        <div
                          className="h-2.5 rounded-md bg-linear-to-r from-zinc-800/60 via-zinc-700/30 to-zinc-800/60 animate-shimmer"
                          style={{ width: `${70 - i * 8}%`, backgroundSize: "200% 100%", animationDelay: `${0.15 * (i + 1)}s` }}
                        />
                        <div
                          className="h-2.5 rounded-md bg-linear-to-r from-zinc-800/60 via-zinc-700/30 to-zinc-800/60 animate-shimmer"
                          style={{ width: `${55 - i * 5}%`, backgroundSize: "200% 100%", animationDelay: `${0.3 * (i + 1)}s` }}
                        />
                      </div>
                    </div>
                  ))
                )}

                {/* Actual AI examples — each row has a fixed height with hard overflow cut */}
                {!showShimmers && visibleExamples.map((example, i) => (
                  <button
                    key={`ai-example-${i}`}
                    type="button"
                    onClick={() => handleExampleClick(example)}
                    className="text-left text-[11px] leading-4 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg px-2.5 transition-colors border border-transparent hover:border-zinc-700/50 animate-in fade-in-50 duration-300 overflow-hidden"
                    style={{ height: EXAMPLE_ROW_HEIGHT, display: "flex", alignItems: "flex-start", paddingTop: 6, paddingBottom: 0 }}
                  >
                    <BotMessageSquare size={9} className="text-violet-400/70 shrink-0 mt-0.75 mr-1.5" />
                    <span className="overflow-hidden" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{example}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

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
        </>
      )}
    </div>
  );
}

