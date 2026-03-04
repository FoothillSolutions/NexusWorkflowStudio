"use client";
import { useEffect, useCallback, useMemo, useRef } from "react";
import { useWatch, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PromptFieldGroup } from "@/nodes/shared/prompt-field-group";
import { detectVariables, DetectedVariablesPanel, DYNAMIC_VAR_RE, STATIC_VAR_RE } from "@/nodes/shared/variable-utils";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";
import { RequiredIndicator } from "@/nodes/shared/required-indicator";
import { SubAgentMemory } from "./types";
import { PRESET_COLORS } from "./constants";
import { Check, Zap, Plus, Minus, ArrowRight, X, FileText, Link, Upload, ChevronDown, FileIcon, BoltIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { NODE_ACCENT } from "@/lib/node-colors";
import { useWorkflowStore } from "@/store/workflow-store";
import { ModelSelect } from "@/nodes/shared/model-select";
import { AiPromptGenerator } from "./ai-prompt-generator";
import { parseAgentFile } from "./parse-agent-file";
import { toast } from "sonner";
import { useTools } from "@/hooks/use-tools";

const MEMORY_OPTIONS = [
	{ value: SubAgentMemory.Default, label: "- (default)" },
	{ value: SubAgentMemory.Local, label: "local" },
	{ value: SubAgentMemory.User, label: "user" },
	{ value: SubAgentMemory.Project, label: "project" },
];

const SELECT_CLASS =
	"w-full rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-600";

interface SubAgentFieldsProps {
	control: FormControl;
	setValue: FormSetValue;
	nodeId?: string;
}

export function Fields({ control, setValue, nodeId }: SubAgentFieldsProps) {
  const promptText: string  = useWatch({ control, name: "promptText" }) ?? "";
  const rawTemp             = useWatch({ control, name: "temperature" });
  const temperature         = rawTemp != null ? Number(rawTemp) : 0;
  const color: string       = useWatch({ control, name: "color" }) || NODE_ACCENT.agent;
  const disabledTools: string[] = useWatch({ control, name: "disabledTools" }) ?? [];
  const parameterMappings: string[] = useWatch({ control, name: "parameterMappings" }) ?? [];
  const variableMappings: Record<string, string> = useWatch({ control, name: "variableMappings" }) ?? {};
  const modelValue: string  = useWatch({ control, name: "model" }) ?? "inherit";

  // Fetch dynamic tools for the selected model (falls back to static AGENT_TOOLS)
  const { tools: availableTools, isLoading: toolsLoading, isStatic: toolsStatic } = useTools(modelValue);

  // Keep a ref in sync so the updateVarMapping callback can read the latest
  // value without depending on the object identity (avoids re-render loops).
  const variableMappingsRef = useRef(variableMappings);
  variableMappingsRef.current = variableMappings;

  // Derive connected skill nodes from the store.
  // Step 1: selector extracts only the skill edge data we need. This produces
  // a string key that only changes when skill connections actually change —
  // not on every position-change frame during a drag.
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  const skillEdgeKey = useWorkflowStore(
    useCallback(
      (s) => {
        if (!nodeId) return "";
        return s.edges
          .filter((e) => e.target === nodeId && e.targetHandle === "skills")
          .map((e) => `${e.id}:${e.source}`)
          .join(",");
      },
      [nodeId]
    )
  );

  // Step 2: derive the full connected skills objects only when the key changes
  const connectedSkills = useMemo(() => {
    if (!skillEdgeKey) return [];
    const state = useWorkflowStore.getState();
    return state.edges
      .filter((e) => e.target === nodeId && e.targetHandle === "skills")
      .map((e) => ({ edge: e, node: state.nodes.find((n) => n.id === e.source) }))
      .filter((item): item is { edge: typeof state.edges[number]; node: NonNullable<typeof item.node> } => !!item.node);
  }, [skillEdgeKey, nodeId]);

  // Connected document nodes — same pattern as skills
  const docEdgeKey = useWorkflowStore(
    useCallback(
      (s) => {
        if (!nodeId) return "";
        return s.edges
          .filter((e) => e.target === nodeId && e.targetHandle === "docs")
          .map((e) => `${e.id}:${e.source}`)
          .join(",");
      },
      [nodeId]
    )
  );

  const connectedDocs = useMemo(() => {
    if (!docEdgeKey) return [];
    const state = useWorkflowStore.getState();
    return state.edges
      .filter((e) => e.target === nodeId && e.targetHandle === "docs")
      .map((e) => ({ edge: e, node: state.nodes.find((n) => n.id === e.source) }))
      .filter((item): item is { edge: typeof state.edges[number]; node: NonNullable<typeof item.node> } => !!item.node);
  }, [docEdgeKey, nodeId]);

  // Build available resources for static variable mapping.
  // Uses a zustand selector that produces a serialised key so the component
  // re-renders when connected nodes' names/labels change, not just edges.
  const resourceKey = useWorkflowStore(
    useCallback(
      (s) => {
        if (!nodeId) return "";
        const parts: string[] = [];
        for (const e of s.edges) {
          if (e.target !== nodeId) continue;
          const n = s.nodes.find((nd) => nd.id === e.source);
          if (!n) continue;
          if (n.data?.type === "document") {
            const d = n.data as Record<string, unknown>;
            parts.push(`doc:${e.source}:${d.docName ?? ""}:${d.fileExtension ?? ""}:${d.label ?? ""}`);
          } else if (n.data?.type === "skill") {
            const d = n.data as Record<string, unknown>;
            parts.push(`skill:${e.source}:${d.skillName ?? ""}:${d.label ?? ""}`);
          }
        }
        return parts.sort().join("|");
      },
      [nodeId]
    )
  );

  const availableResources = useMemo(() => {
    const resources: { value: string; label: string; kind: "doc" | "skill" }[] = [];
    if (!resourceKey) return resources;
    const state = useWorkflowStore.getState();
    const allNodes = state.nodes;
    const allEdges = state.edges;

    for (const edge of allEdges) {
      if (edge.target !== nodeId) continue;
      const sourceNode = allNodes.find((n) => n.id === edge.source);
      if (!sourceNode) continue;

      if (sourceNode.data?.type === "document") {
        const d = sourceNode.data as { docName?: string; fileExtension?: string; label?: string; name?: string };
        const docName = d.docName?.trim();
        const ext = d.fileExtension || "md";
        const displayName = docName ? `${docName}.${ext}` : (d.label || d.name || edge.source);
        resources.push({
          value: docName ? `doc:${docName}.${ext}` : `doc-id:${edge.source}`,
          label: `📄 ${displayName}`,
          kind: "doc",
        });
      } else if (sourceNode.data?.type === "skill") {
        const d = sourceNode.data as { skillName?: string; label?: string; name?: string };
        const skillName = d.skillName?.trim() || d.label?.trim();
        const displayName = skillName || d.name || edge.source;
        resources.push({
          value: skillName ? `skill:${skillName}` : `skill-id:${edge.source}`,
          label: `⚡ ${displayName}`,
          kind: "skill",
        });
      }
    }

    return resources;
  }, [resourceKey, nodeId]);

  const updateVarMapping = useCallback(
    (varName: string, value: string) => {
      // Read current mappings from the watched value at call-time to avoid
      // putting the object in the dependency array (which changes every render).
      const current: Record<string, string> = { ...variableMappingsRef.current };
      if (value) {
        current[varName] = value;
      } else {
        delete current[varName];
      }
      setValue("variableMappings" as never, current as never, { shouldDirty: true });
    },
    [setValue]
  );

	const { dynamic, static: staticVars } = detectVariables(promptText);
	const allVars = [...dynamic, ...staticVars];

	useEffect(() => {
		setValue("detectedVariables" as never, allVars as never, { shouldDirty: false });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [promptText]);

	// Auto-expand parameterMappings slots when the prompt gains new $N variables.
	// New slots default to identity mapping ($1→$1, $2→$2, …).
	useEffect(() => {
		if (dynamic.length > parameterMappings.length) {
			const expanded = [...parameterMappings];
			while (expanded.length < dynamic.length) {
				expanded.push(`$${expanded.length + 1}`);
			}
			setValue("parameterMappings" as never, expanded as never, { shouldDirty: false });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dynamic.length]);

	const updateMapping = (index: number, value: string) => {
		const next = [...parameterMappings];
		next[index] = value;
		setValue("parameterMappings" as never, next as never, { shouldDirty: true });
	};

	const addMappingSlot = () => {
		setValue("parameterMappings" as never, [...parameterMappings, ""] as never, { shouldDirty: true });
	};

	const removeMappingSlot = (index: number) => {
		const next = parameterMappings.filter((_, i) => i !== index);
		setValue("parameterMappings" as never, next as never, { shouldDirty: true });
	};

	/** Return a Tailwind class for the input based on the value type */
	const mappingValueClass = (value: string): string => {
		const trimmed = value.trim();
		if (new RegExp(DYNAMIC_VAR_RE.source).test(trimmed)) return "text-blue-300";
		if (new RegExp(STATIC_VAR_RE.source).test(trimmed)) return "text-amber-300";
		if (trimmed) return "text-emerald-300";
		return "text-zinc-100";
	};

	const toggleTool = (tool: string) => {
		const next = disabledTools.includes(tool)
			? disabledTools.filter((t) => t !== tool)
			: [...disabledTools, tool];
		setValue("disabledTools" as never, next as never, { shouldDirty: true });
	};

	// ── Upload Agent file handler ─────────────────────────────────────
	const agentFileInputRef = useRef<HTMLInputElement>(null);

	const handleAgentUpload = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
			if (ext !== "md") {
				toast.error("Only .md agent files are supported");
				return;
			}

			const reader = new FileReader();
			reader.onload = () => {
				try {
					const raw = reader.result as string;
					const parsed = parseAgentFile(raw);

					if (parsed.description !== undefined)
						setValue("description" as never, parsed.description as never, { shouldDirty: true });
					if (parsed.model !== undefined)
						setValue("model" as never, parsed.model as never, { shouldDirty: true });
					if (parsed.memory !== undefined)
						setValue("memory" as never, parsed.memory as never, { shouldDirty: true });
					if (parsed.temperature !== undefined)
						setValue("temperature" as never, parsed.temperature as never, { shouldDirty: true });
					if (parsed.color !== undefined)
						setValue("color" as never, parsed.color as never, { shouldDirty: true });
					if (parsed.disabledTools !== undefined)
						setValue("disabledTools" as never, parsed.disabledTools as never, { shouldDirty: true });
					if (parsed.variableMappings !== undefined)
						setValue("variableMappings" as never, parsed.variableMappings as never, { shouldDirty: true });
					if (parsed.promptText !== undefined)
						setValue("promptText" as never, parsed.promptText as never, { shouldDirty: true });

					// Derive a name from the filename (strip .md extension)
					const baseName = file.name.replace(/\.md$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-");
					if (baseName) {
						setValue("name" as never, baseName as never, { shouldDirty: true });
					}

					toast.success(`Loaded agent from ${file.name}`);
				} catch {
					toast.error("Failed to parse agent file");
				}
			};
			reader.onerror = () => toast.error("Failed to read file");
			reader.readAsText(file);

			// Reset so the same file can be re-uploaded
			e.target.value = "";
		},
		[setValue]
	);

	return (
		<div className="space-y-5 overflow-hidden">
			{/* Upload Agent File */}
			<div className="space-y-2">
				<input
					ref={agentFileInputRef}
					type="file"
					accept=".md"
					onChange={handleAgentUpload}
					className="hidden"
				/>
				<Button
					type="button"
					variant="ghost"
					onClick={() => agentFileInputRef.current?.click()}
					className="w-full h-16 rounded-xl border-2 border-dashed border-zinc-700/60 hover:border-violet-700/60 text-zinc-500 hover:text-violet-400 transition-all flex flex-col gap-1"
				>
					<Upload size={18} />
					<span className="text-xs">Upload Agent <code className="font-mono text-[10px] text-zinc-600">.md</code></span>
				</Button>
				<p className="text-[10px] text-zinc-600 text-center">
					Import an existing agent file
				</p>
			</div>

			{/* Description */}
			<div className="space-y-2">
				<Label htmlFor="description">
					Description <RequiredIndicator />
				</Label>
				<Controller
					name="description"
					control={control}
					render={({ field }) => (
						<Textarea
							id="description"
							placeholder="What does this agent do?"
							className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 min-h-[72px] resize-none text-sm"
							value={field.value ?? ""}
							onChange={field.onChange}
						/>
					)}
				/>
			</div>

			{/* Prompt */}
			<PromptFieldGroup
				control={control}
				setValue={setValue}
				value={promptText}
				label="Prompt"
				htmlId="promptText"
				height={180}
				placeholder="Enter your prompt here"
				required
			/>

			{/* AI Prompt Generator */}
			<AiPromptGenerator setValue={setValue} currentPrompt={promptText} nodeId={nodeId} />

			<DetectedVariablesPanel dynamic={dynamic} staticVars={staticVars} />

			{/* Static Variable Mapping — map {{vars}} to connected docs/skills */}
			{staticVars.length > 0 && (
				<div className="space-y-2.5 overflow-hidden">
					<div className="flex items-center justify-between">
						<Label className="text-xs text-zinc-400 flex items-center gap-1.5">
							<Link className="h-3 w-3" />
							Variable Mapping
						</Label>
						{availableResources.length > 0 && (() => {
							const mappedCount = Object.keys(variableMappings).filter((k) => staticVars.includes(k) && variableMappings[k]).length;
							const allMapped = mappedCount === staticVars.length;
							return (
								<span className={cn(
									"text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
									allMapped
										? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/30"
										: "text-zinc-500"
								)}>
									{mappedCount}/{staticVars.length} mapped
								</span>
							);
						})()}
					</div>
					<p className="text-[11px] text-zinc-500 leading-relaxed">
						Map <code className="text-amber-400/80 font-semibold">{"{{"}</code>static<code className="text-amber-400/80 font-semibold">{"}}"}</code> variables to connected documents or skills.
					</p>
					<div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 divide-y divide-zinc-700/30 overflow-hidden">
						{staticVars.map((varName) => {
							const currentValue = variableMappings[varName] ?? "";
							const isMapped = !!currentValue;
							const hasResources = availableResources.length > 0;
							return (
								<div key={varName} className="flex items-center gap-2.5 px-3 py-2.5 min-w-0 overflow-hidden hover:bg-zinc-700/10 transition-colors">
									<span
										className={cn(
											"text-[11px] font-mono px-2 py-1 rounded-lg shrink-0 truncate max-w-[110px] transition-colors",
											isMapped
												? "text-amber-300 bg-amber-500/10 border border-amber-500/20"
												: "text-amber-300/70 bg-amber-950/30 border border-amber-800/20"
										)}
										title={`{{${varName}}}`}
									>
										{`{{${varName}}}`}
									</span>
									<svg className="h-3 w-3 text-zinc-600 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
										<path d="M2.5 6h7M7 3.5 9.5 6 7 8.5" />
									</svg>
									{hasResources ? (
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<button
													type="button"
													className={cn(
														"w-0 flex-1 flex items-center justify-between rounded-lg border text-xs px-2.5 h-8 transition-all cursor-pointer truncate",
														"bg-zinc-900/50 hover:bg-zinc-800/60 focus:outline-none focus:ring-1 focus:ring-zinc-600",
														isMapped
															? "border-amber-700/30 text-amber-200"
															: "border-zinc-700/50 text-zinc-500"
													)}
												>
													<span className="truncate">
														{isMapped
															? availableResources.find((r) => r.value === currentValue)?.label ?? currentValue
															: "Select resource…"}
													</span>
													<ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="start" className="w-56 bg-zinc-900 border-zinc-700/60">
												{isMapped && (
													<>
														<DropdownMenuItem
															onClick={() => updateVarMapping(varName, "")}
															className="text-xs text-zinc-500 focus:bg-zinc-800 focus:text-zinc-300"
														>
															Clear selection
														</DropdownMenuItem>
														<DropdownMenuSeparator className="bg-zinc-700/40" />
													</>
												)}
												{availableResources.filter((r) => r.kind === "doc").length > 0 && (
													<>
														<DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
															Documents
														</DropdownMenuLabel>
														{availableResources
															.filter((r) => r.kind === "doc")
															.map((r) => (
																<DropdownMenuItem
																	key={r.value}
																	onClick={() => updateVarMapping(varName, r.value)}
																	className={cn(
																		"text-xs gap-2 focus:bg-zinc-800",
																		currentValue === r.value
																			? "text-amber-200 focus:text-amber-200"
																			: "text-zinc-300 focus:text-zinc-100"
																	)}
																>
																	<FileIcon className="h-3 w-3 text-yellow-500/70 shrink-0" />
																	<span className="truncate flex-1">{r.label.replace(/^📄\s*/, "")}</span>
																	{currentValue === r.value && (
																		<Check className="h-3 w-3 text-amber-400 shrink-0 ml-auto" />
																	)}
																</DropdownMenuItem>
															))}
													</>
												)}
												{availableResources.filter((r) => r.kind === "doc").length > 0 &&
													availableResources.filter((r) => r.kind === "skill").length > 0 && (
														<DropdownMenuSeparator className="bg-zinc-700/40" />
													)}
												{availableResources.filter((r) => r.kind === "skill").length > 0 && (
													<>
														<DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
															Skills
														</DropdownMenuLabel>
														{availableResources
															.filter((r) => r.kind === "skill")
															.map((r) => (
																<DropdownMenuItem
																	key={r.value}
																	onClick={() => updateVarMapping(varName, r.value)}
																	className={cn(
																		"text-xs gap-2 focus:bg-zinc-800",
																		currentValue === r.value
																			? "text-amber-200 focus:text-amber-200"
																			: "text-zinc-300 focus:text-zinc-100"
																	)}
																>
																	<BoltIcon className="h-3 w-3 text-cyan-500/70 shrink-0" />
																	<span className="truncate flex-1">{r.label.replace(/^⚡\s*/, "")}</span>
																	{currentValue === r.value && (
																		<Check className="h-3 w-3 text-amber-400 shrink-0 ml-auto" />
																	)}
																</DropdownMenuItem>
															))}
													</>
												)}
											</DropdownMenuContent>
										</DropdownMenu>
									) : (
										<span className="flex-1 min-w-0 text-[11px] text-zinc-500 italic truncate">
											Connect a Document or Skill to map
										</span>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Parameter Mapping — map workflow-level args to this agent's $N slots */}
			{(parameterMappings.length > 0 || dynamic.length > 0) && (
				<div className="space-y-2.5">
					<div className="flex items-center justify-between">
						<Label className="text-xs text-zinc-400 flex items-center gap-1.5">
							<ArrowRight className="h-3 w-3" />
							Parameter Mapping
						</Label>
						<span className={cn(
							"text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
							parameterMappings.filter(Boolean).length === parameterMappings.length && parameterMappings.length > 0
								? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/30"
								: "text-zinc-500"
						)}>
							{parameterMappings.filter(Boolean).length} mapped
						</span>
					</div>
					<p className="text-[11px] text-zinc-500 leading-relaxed">
						Map workflow-level values to this agent&apos;s positional parameters.
						Use <code className="text-blue-400/80 font-semibold">$N</code> for positional passthrough,{" "}
						<code className="text-amber-400/80 font-semibold">{"{{ref}}"}</code> for static refs, or a literal value.
					</p>
					<div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 overflow-hidden">
						<div className="divide-y divide-zinc-700/30">
							{parameterMappings.map((value, index) => (
								<div key={index} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-700/10 transition-colors">
									<span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 w-10 h-6 flex items-center justify-center rounded-md shrink-0">
										${index + 1}
									</span>
									<svg className="h-3 w-3 text-zinc-600 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
										<path d="M2.5 6h7M7 3.5 9.5 6 7 8.5" />
									</svg>
									<Input
										value={value}
										onChange={(e) => updateMapping(index, e.target.value)}
										placeholder={`e.g. $${index + 1}, {{name}}, or literal`}
										className={cn(
											"bg-zinc-900/50 border-zinc-700/50 rounded-lg text-xs font-mono h-8 flex-1 transition-all",
											"focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600",
											mappingValueClass(value)
										)}
									/>
									<button
										type="button"
										onClick={() => removeMappingSlot(index)}
										className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/20 transition-all shrink-0"
										title="Remove slot"
									>
										<Minus className="h-3 w-3" />
									</button>
								</div>
							))}
						</div>
						<div className="px-3 py-2 border-t border-zinc-700/30">
							<button
								type="button"
								onClick={addMappingSlot}
								className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors w-full justify-center py-0.5 rounded-lg hover:bg-zinc-700/10"
							>
								<Plus className="h-3 w-3" />
								Add parameter slot
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Connected Skills — shown after prompt & variables */}
			{connectedSkills.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center gap-1.5">
						<Zap size={12} className="text-cyan-400" />
						<Label className="text-cyan-300">Connected Skills ({connectedSkills.length})</Label>
					</div>
					<div className="flex flex-col gap-1">
						{connectedSkills.map(({ edge, node: skillNode }) => {
							const d = skillNode.data as { skillName?: string; projectName?: string; label?: string };
							return (
								<div
									key={skillNode.id}
									className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-cyan-950/30 border border-cyan-800/30 text-xs min-w-0"
								>
									<Zap size={10} className="text-cyan-500 shrink-0" />
									<span className="text-cyan-200 font-medium truncate min-w-0 flex-1" title={d.skillName || d.label || skillNode.id}>
										{d.skillName || d.label || skillNode.id}
									</span>
									{d.projectName && (
										<span className="text-cyan-600 truncate ml-auto">{d.projectName}</span>
									)}
									<button
										type="button"
										onClick={() => deleteEdge(edge.id)}
										className="p-0.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-colors shrink-0 ml-auto"
										title="Remove skill connection"
									>
										<X size={12} />
									</button>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Connected Documents — shown after skills */}
			{connectedDocs.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center gap-1.5">
						<FileText size={12} className="text-yellow-400" />
						<Label className="text-yellow-300">Connected Documents ({connectedDocs.length})</Label>
					</div>
					<div className="flex flex-col gap-1">
						{connectedDocs.map(({ edge, node: docNode }) => {
							const d = docNode.data as { docName?: string; fileExtension?: string; label?: string };
							return (
								<div
									key={docNode.id}
									className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-yellow-950/30 border border-yellow-800/30 text-xs min-w-0"
								>
									<FileText size={10} className="text-yellow-500 shrink-0" />
									<span className="text-yellow-200 font-medium truncate min-w-0 flex-1" title={`${d.docName || d.label || docNode.id}${d.fileExtension ? `.${d.fileExtension}` : ""}`}>
										{d.docName || d.label || docNode.id}
										{d.fileExtension && <span className="text-yellow-600">.{d.fileExtension}</span>}
									</span>
									<button
										type="button"
										onClick={() => deleteEdge(edge.id)}
										className="p-0.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-colors shrink-0 ml-auto"
										title="Remove document connection"
									>
										<X size={12} />
									</button>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Model */}
			<div className="space-y-2">
				<Label htmlFor="model">Model</Label>
				<Controller
					name="model"
					control={control}
					render={({ field }) => (
						<ModelSelect value={field.value} onChange={field.onChange} />
					)}
				/>
			</div>

			{/* Memory */}
			<div className="space-y-2 opacity-40 pointer-events-none">
				<div className="flex items-center gap-2">
					<Label htmlFor="memory">Memory</Label>
					<span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Coming soon</span>
				</div>
				<Controller
					name="memory"
					control={control}
					render={({ field }) => (
						<select id="memory" className={SELECT_CLASS} value={field.value} onChange={field.onChange} disabled>
							{MEMORY_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					)}
				/>
			</div>

			{/* Temperature */}
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label htmlFor="temperature">Temperature</Label>
					<span className="text-xs font-mono text-zinc-400 tabular-nums">
						{temperature.toFixed(1)}
					</span>
				</div>
				<Controller
					name="temperature"
					control={control}
					render={({ field }) => {
							const val = field.value != null ? Number(field.value) : 0;
							return (
								<div className="relative flex items-center">
									<input
										id="temperature"
										type="range"
										min={0}
										max={1}
										step={0.1}
										value={val}
										onChange={(e) => field.onChange(parseFloat(e.target.value))}
										className="w-full h-2 appearance-none cursor-pointer rounded-full bg-zinc-700/60 accent-violet-500"
										style={{
											background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(val * 100).toFixed(1)}%, rgb(63 63 70 / 0.6) ${(val * 100).toFixed(1)}%, rgb(63 63 70 / 0.6) 100%)`,
										}}
									/>
								</div>
							);
						}}
				/>
				<div className="flex justify-between text-[10px] text-zinc-600 font-mono px-0.5">
					<span>Deterministic</span>
					<span>Creative</span>
				</div>
			</div>

			{/* Tools */}
			<div className="space-y-2.5">
				<div className="flex items-center justify-between">
					<Label className="flex items-center gap-1.5">
						Tools
						{!toolsStatic && !toolsLoading && (
							<span className="text-[9px] font-medium text-violet-400/70 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-full leading-none">
								dynamic
							</span>
						)}
					</Label>
					<div className="flex items-center gap-1.5">
						{toolsLoading && <Loader2 size={10} className="animate-spin text-zinc-500" />}
						<span className="text-[10px] text-zinc-500 tabular-nums">
							{disabledTools.length === 0 ? "All enabled" : `${disabledTools.length} disabled`}
						</span>
					</div>
				</div>
				<div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 p-2.5">
					<div className="flex flex-wrap gap-1.5">
						{availableTools.map((tool) => {
							const isDisabled = disabledTools.includes(tool);
							return (
								<button
									key={tool}
									type="button"
									onClick={() => toggleTool(tool)}
									title={tool}
									className={cn(
										"inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all duration-150 whitespace-nowrap select-none",
										isDisabled
											? "bg-red-950/40 border-red-900/40 text-red-400/80 hover:bg-red-950/60"
											: "bg-zinc-800/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-700/60 hover:border-zinc-600/60"
									)}
								>
									<span className={cn(
										"w-1.5 h-1.5 rounded-full shrink-0 transition-colors",
										isDisabled ? "bg-red-500/70" : "bg-emerald-500/70"
									)} />
									<span className={cn(isDisabled && "line-through decoration-red-500/40")}>
										{tool}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{/* Color */}
			<div className="space-y-2.5">
				<Label>Color</Label>
				<div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 overflow-hidden">
					{/* Live preview bar */}
					<div
						className="h-2 w-full transition-colors duration-200"
						style={{ backgroundColor: color }}
					/>
					{/* Preset swatches */}
					<div className="p-3 pb-2.5">
						<div className="flex flex-wrap gap-1.5 justify-center">
							{PRESET_COLORS.map((preset) => {
								const isActive = color === preset;
								return (
									<button
										key={preset}
										type="button"
										onClick={() => setValue("color" as never, preset as never, { shouldDirty: true })}
										className={cn(
											"w-6 h-6 rounded-full transition-all duration-150 flex items-center justify-center ring-offset-1 ring-offset-zinc-900",
											isActive
												? "ring-2 ring-white/60 scale-110"
												: "hover:scale-110 hover:ring-1 hover:ring-white/20"
										)}
										style={{ backgroundColor: preset }}
										title={preset}
									>
										{isActive && (
											<Check className="h-2.5 w-2.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
										)}
									</button>
								);
							})}
						</div>
					</div>
					{/* Custom color row */}
					<div className="px-3 pb-3">
						<Controller
							name="color"
							control={control}
							render={({ field }) => (
								<div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 border border-zinc-700/30 px-2 py-1.5">
									<div className="relative">
										<input
											type="color"
											value={field.value?.trim() ? field.value : NODE_ACCENT.agent}
											onChange={(e) => field.onChange(e.target.value)}
											className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
											title="Pick custom color"
										/>
										<div
											className="w-6 h-6 rounded-md border border-zinc-600/50 cursor-pointer shadow-sm"
											style={{ backgroundColor: field.value?.trim() ? field.value : NODE_ACCENT.agent }}
										/>
									</div>
									<Input
										value={field.value?.trim() ? field.value : NODE_ACCENT.agent}
										onChange={(e) => field.onChange(e.target.value)}
										className="bg-transparent border-0 shadow-none focus-visible:ring-0 font-mono text-xs uppercase text-zinc-300 h-6 px-1"
										placeholder={NODE_ACCENT.agent}
										maxLength={7}
									/>
								</div>
							)}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

