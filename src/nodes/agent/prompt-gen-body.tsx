"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  Sparkles, Wand2, ChevronDown, Loader2, Check, RotateCcw,
  Layers, FileText, Square, Lightbulb, Eye, Lock,
  FolderTree, GitBranch, FileCode, TestTubes, Type, Target, Variable, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FullscreenMarkdownEditor } from "@/components/ui/fullscreen-markdown-editor";
import { ModelSelect } from "@/nodes/shared/model-select";
import { SubAgentModel } from "@/nodes/agent/enums";
import { useOpenCodeStore } from "@/store/opencode-store";
import {
  usePromptGenStore,
  type PromptGenTemplateFields,
} from "@/store/prompt-gen-store";
import { getConnectedResourceNames } from "@/nodes/agent/properties/use-connected-resources";

// ── Template section config ──────────────────────────────────────────────────

interface TemplateSection {
  key: keyof PromptGenTemplateFields;
  label: string;
  icon: React.ElementType;
  placeholder: string;
  hint: string;
  rows: number;
}

const SECTIONS: TemplateSection[] = [
  { key: "title", label: "Title", icon: Type, placeholder: "e.g. Generate Weekly Refund Report", hint: "[Verb] [Object] [Context]", rows: 1 },
  { key: "purpose", label: "Purpose", icon: Target, placeholder: "What it does, why it exists, success criteria…", hint: "High-level function & business value", rows: 3 },
  { key: "variables", label: "Variables", icon: Variable, placeholder: "$1 = date range start\n{{agent_name}} = \"reporter\"", hint: "Dynamic $N, static {{named}}, derived values", rows: 4 },
  { key: "instructions", label: "Instructions", icon: ListChecks, placeholder: "Primary rules, constraints, edge cases…", hint: "Non-negotiable rules & forbidden actions", rows: 5 },
  { key: "relevantFiles", label: "Relevant Files", icon: FileText, placeholder: "path/to/input.ext\nconfigs/*.yml", hint: "Required inputs, optional refs, file patterns", rows: 3 },
  { key: "codebaseStructure", label: "Codebase Structure", icon: FolderTree, placeholder: "src/ — core logic\nconfigs/ — environment", hint: "Top-level layout & where to make changes", rows: 3 },
  { key: "workflow", label: "Workflow", icon: GitBranch, placeholder: "1. Parse inputs\n2. Validate\n3. Process", hint: "Execution steps with control flow branches", rows: 5 },
  { key: "template", label: "Template", icon: FileCode, placeholder: "Standard boilerplate or referenced template…", hint: "Output template or boilerplate snippet", rows: 3 },
  { key: "examples", label: "Examples", icon: TestTubes, placeholder: "Example 1: $1=\"2026-03-01\" → Generate summary", hint: "Input/output examples including edge cases", rows: 4 },
];

function resolveModelIds(model: string): { providerId: string; modelId: string } {
  if (model === SubAgentModel.Inherit || !model) {
    return { providerId: "github-copilot", modelId: "claude-sonnet-4.5" };
  }
  const parts = model.split("/");
  if (parts.length === 2) return { providerId: parts[0], modelId: parts[1] };
  return { providerId: "github-copilot", modelId: model };
}

// ── Shared body used by both docked and floating prompt gen ──────────────────

export function PromptGenBody() {
  const [genModel, setGenModel] = useState<string>("github-copilot/claude-sonnet-4.5");
  const [viewOpen, setViewOpen] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const view = usePromptGenStore((s) => s.view);
  const mode = usePromptGenStore((s) => s.mode);
  const freeformText = usePromptGenStore((s) => s.freeformText);
  const editInstruction = usePromptGenStore((s) => s.editInstruction);
  const fields = usePromptGenStore((s) => s.fields);
  const expandedSections = usePromptGenStore((s) => s.expandedSections);
  const targetPrompt = usePromptGenStore((s) => s.targetPrompt);
  const targetNodeType = usePromptGenStore((s) => s.targetNodeType);
  const status = usePromptGenStore((s) => s.status);
  const generatedText = usePromptGenStore((s) => s.generatedText);
  const generatedTokens = usePromptGenStore((s) => s.generatedTokens);
  const error = usePromptGenStore((s) => s.error);

  const setMode = usePromptGenStore((s) => s.setMode);
  const setFreeformText = usePromptGenStore((s) => s.setFreeformText);
  const setEditInstruction = usePromptGenStore((s) => s.setEditInstruction);
  const updateField = usePromptGenStore((s) => s.updateField);
  const toggleSection = usePromptGenStore((s) => s.toggleSection);
  const generate = usePromptGenStore((s) => s.generate);
  const editWithAi = usePromptGenStore((s) => s.editWithAi);
  const cancel = usePromptGenStore((s) => s.cancel);
  const applyResult = usePromptGenStore((s) => s.applyResult);

  const isConnected = useOpenCodeStore((s) => s.status) === "connected";

  const isPromptNode = targetNodeType === "prompt";

  const isGenerating = status === "generating" || status === "streaming" || status === "creating-session";
  const hasResult = status === "done" && generatedText.trim().length > 0;
  const hasPrompt = targetPrompt.trim().length > 0;
  const isEditMode = view === "edit";

  const filledCount = useMemo(
    () => SECTIONS.filter((s) => fields[s.key]?.trim()).length,
    [fields],
  );

  const canSubmit = isEditMode
    ? !!editInstruction.trim()
    : mode === "freeform"
      ? !!freeformText.trim()
      : filledCount > 0;

  // Auto-scroll result while streaming
  useEffect(() => {
    if ((status === "streaming" || status === "done") && resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [generatedText, status]);

  const handleGenerate = useCallback(() => {
    const { providerId, modelId } = resolveModelIds(genModel);
    const targetNodeId = usePromptGenStore.getState().targetNodeId;
    const connectedResourceNames = getConnectedResourceNames(targetNodeId);
    const nodeType = usePromptGenStore.getState().targetNodeType ?? "agent";
    generate({ fields, modelId, providerId, mode, freeformDescription: mode === "freeform" ? freeformText : undefined, connectedResourceNames, nodeType });
  }, [fields, genModel, mode, freeformText, generate]);

  const handleEdit = useCallback(() => {
    if (!editInstruction.trim()) return;
    const { providerId, modelId } = resolveModelIds(genModel);
    const targetNodeId = usePromptGenStore.getState().targetNodeId;
    const connectedResourceNames = getConnectedResourceNames(targetNodeId);
    const nodeType = usePromptGenStore.getState().targetNodeType ?? "agent";
    editWithAi({ currentPrompt: targetPrompt, editInstruction, modelId, providerId, connectedResourceNames, nodeType });
  }, [targetPrompt, editInstruction, genModel, editWithAi]);

  return (
    <>
      {/* Model selector */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Generation Model</Label>
        <ModelSelect value={genModel} onChange={setGenModel} />
      </div>

      {/* ── Generate view ──────────────────────────────────────── */}
      {!isEditMode && (
        <>
          {/* Mode tabs */}
          <div className="flex rounded-lg bg-zinc-800/40 p-0.5 border border-zinc-700/30">
            <button type="button" onClick={() => setMode("freeform")} className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all",
              mode === "freeform" ? "bg-violet-600/20 text-violet-200 border border-violet-600/30" : "text-zinc-500 hover:text-zinc-300 border border-transparent",
            )}>
              <Lightbulb size={12} /> Freeform
            </button>
            <button type="button" onClick={() => setMode("structured")} className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all",
              mode === "structured" ? "bg-violet-600/20 text-violet-200 border border-violet-600/30" : "text-zinc-500 hover:text-zinc-300 border border-transparent",
            )}>
              <Layers size={12} /> Structured
              {filledCount > 0 && <span className="ml-1 text-[9px] bg-violet-600/30 text-violet-300 px-1.5 py-0.5 rounded-full">{filledCount}</span>}
            </button>
          </div>

          {/* Freeform input */}
          {mode === "freeform" && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">
                {isPromptNode ? "Describe the prompt you want" : "Describe the prompt you need"}
              </Label>
              <Textarea
                value={freeformText}
                onChange={(e) => setFreeformText(e.target.value)}
                placeholder={isPromptNode
                  ? "e.g. Write a prompt that takes a topic and generates a structured blog post with an intro, 3 key points, and a conclusion…"
                  : "e.g. Create an agent that triages support tickets, categorizes by priority, and generates a daily report…"}
                className="bg-zinc-800/40 border-zinc-700/40 rounded-lg text-sm min-h-[80px] resize-none focus-visible:ring-violet-600/40 placeholder:text-zinc-600"
                rows={3}
                disabled={isGenerating}
              />
            </div>
          )}

          {/* Structured accordion */}
          {mode === "structured" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Template Sections</Label>
                <span className="text-[10px] text-zinc-600">All optional</span>
              </div>
              <div className="rounded-lg border border-zinc-700/30 bg-zinc-900/30 divide-y divide-zinc-800/50">
                {SECTIONS.map((sec) => {
                  const isOpen = expandedSections.has(sec.key);
                  const filled = !!fields[sec.key]?.trim();
                  const Icon = sec.icon;
                  return (
                    <div key={sec.key}>
                      <button type="button" onClick={() => toggleSection(sec.key)} className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-zinc-800/30",
                        isOpen && "bg-zinc-800/20",
                      )}>
                        <Icon size={13} className={cn("shrink-0", filled ? "text-violet-400" : "text-zinc-600")} />
                        <span className={cn("flex-1 text-xs font-medium", filled ? "text-zinc-200" : "text-zinc-500")}>{sec.label}</span>
                        {filled && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />}
                        <ChevronDown size={12} className={cn("text-zinc-600 shrink-0 transition-transform duration-150", isOpen && "rotate-180")} />
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-2.5 pt-1 space-y-1">
                          <p className="text-[10px] text-zinc-600 italic">{sec.hint}</p>
                          {sec.rows === 1 ? (
                            <Input value={fields[sec.key] ?? ""} onChange={(e) => updateField(sec.key, e.target.value)} placeholder={sec.placeholder} className="bg-zinc-800/50 border-zinc-700/40 rounded-lg text-xs h-8 focus-visible:ring-violet-600/40 placeholder:text-zinc-700" disabled={isGenerating} />
                          ) : (
                            <Textarea value={fields[sec.key] ?? ""} onChange={(e) => updateField(sec.key, e.target.value)} placeholder={sec.placeholder} className="bg-zinc-800/50 border-zinc-700/40 rounded-lg text-xs resize-none focus-visible:ring-violet-600/40 placeholder:text-zinc-700" rows={sec.rows} disabled={isGenerating} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Edit view ──────────────────────────────────────────── */}
      {isEditMode && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Edit instruction</Label>
          <Textarea
            value={editInstruction}
            onChange={(e) => setEditInstruction(e.target.value)}
            placeholder="e.g. Add error handling for missing API keys, make the tone more formal…"
            className="bg-zinc-800/40 border-zinc-700/40 rounded-lg text-sm min-h-[80px] resize-none focus-visible:ring-amber-600/40 placeholder:text-zinc-600"
            rows={3}
            disabled={isGenerating}
          />
          {hasPrompt && (
            <p className="text-[10px] text-zinc-600 flex items-center gap-1">
              <FileText size={10} /> Current prompt ({targetPrompt.length} chars) will be sent as context
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && <div className="rounded-lg bg-red-950/30 border border-red-800/30 px-3 py-2 text-xs text-red-300">{error}</div>}

      {/* ── Result preview ─────────────────────────────────────── */}
      {(isGenerating || hasResult) && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
              {isGenerating
                ? <><Loader2 size={11} className="animate-spin text-violet-400" /> Generating…</>
                : <><Check size={11} className="text-emerald-400" /> Generated Prompt</>}
            </Label>
            <div className="flex items-center gap-2">
              {generatedTokens > 0 && (
                <span className="text-[10px] text-zinc-600 tabular-nums">~{generatedTokens.toLocaleString()} tokens</span>
              )}
              {hasResult && (
                <button
                  type="button"
                  onClick={() => setViewOpen(true)}
                  className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <Eye size={11} />
                  View
                </button>
              )}
            </div>
          </div>
          <div ref={resultRef} className={cn(
            "rounded-lg border bg-zinc-900/60 p-3 text-xs font-mono text-zinc-300 leading-relaxed max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words",
            isGenerating ? "border-violet-700/30 shadow-inner shadow-violet-950/20" : "border-emerald-700/30",
          )}>
            {generatedText || <span className="text-zinc-600 italic">Waiting for response…</span>}
            {isGenerating && <span className="inline-block w-1.5 h-4 ml-0.5 bg-violet-400/60 animate-pulse rounded-sm align-middle" />}
          </div>
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {!hasResult && !isGenerating && (
          <Button
            type="button"
            onClick={isEditMode ? handleEdit : handleGenerate}
            disabled={isGenerating || !canSubmit || !isConnected}
            className={cn(
              "flex-1 h-9 rounded-lg text-xs font-medium gap-2 transition-all",
              isEditMode ? "bg-amber-600 hover:bg-amber-500 text-white" : "bg-violet-600 hover:bg-violet-500 text-white",
            )}
          >
            {isEditMode ? <><Wand2 size={13} /> Edit Prompt</> : <><Sparkles size={13} /> Generate</>}
          </Button>
        )}
        {isGenerating && (
          <Button type="button" onClick={cancel} variant="ghost" className="flex-1 h-9 rounded-lg text-xs font-medium gap-2 text-red-400 hover:text-red-300 hover:bg-red-950/30">
            <Square size={11} /> Stop
          </Button>
        )}
        {hasResult && (
          <>
            <Button type="button" onClick={applyResult} className="flex-1 h-9 rounded-lg text-xs font-medium gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
              <Check size={13} /> Apply to Prompt
            </Button>
            <Button type="button" onClick={isEditMode ? handleEdit : handleGenerate} variant="ghost" className="h-9 px-3 rounded-lg text-xs font-medium gap-1.5 text-zinc-400 hover:text-zinc-200">
              <RotateCcw size={12} /> Redo
            </Button>
          </>
        )}
      </div>

      {!isConnected && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700/40 bg-zinc-800/40 px-3 py-2">
          <Lock size={12} className="text-zinc-500 shrink-0" />
          <span className="text-[11px] text-zinc-500 font-medium">Not connected</span>
          <span className="text-[10px] text-zinc-600">— connect to OpenCode to use AI generation</span>
        </div>
      )}

      {/* Fullscreen Markdown Viewer */}
      <FullscreenMarkdownEditor
        open={viewOpen}
        onOpenChange={setViewOpen}
        value={generatedText}
        onSave={(val) => {
          // Apply the edited markdown directly via the form setValue
          const sv = usePromptGenStore.getState()._formSetValue;
          if (sv) {
            sv("promptText" as never, val as never, { shouldDirty: true });
          }
          setViewOpen(false);
        }}
      />
    </>
  );
}

