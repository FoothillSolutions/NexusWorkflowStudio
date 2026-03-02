"use client";
import { useEffect, useCallback, useMemo, useRef } from "react";
import { useWatch, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PromptFieldGroup } from "@/nodes/shared/prompt-field-group";
import { detectVariables, DetectedVariablesPanel, DYNAMIC_VAR_RE, STATIC_VAR_RE } from "@/nodes/shared/variable-utils";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";
import { RequiredIndicator } from "@/nodes/shared/required-indicator";
import { SubAgentModel, SubAgentMemory, MODEL_DISPLAY_NAMES, MODEL_COST_MULTIPLIER } from "./types";
import { AGENT_TOOLS, PRESET_COLORS } from "./constants";
import type { AgentTool } from "./constants";
import { Check, Zap, Plus, Minus, ArrowRight, X, FileText, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_ACCENT } from "@/lib/node-colors";
import { useWorkflowStore } from "@/store/workflow-store";
import { ModelSelect } from "@/nodes/shared/model-select";

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

	const toggleTool = (tool: AgentTool) => {
		const next = disabledTools.includes(tool)
			? disabledTools.filter((t) => t !== tool)
			: [...disabledTools, tool];
		setValue("disabledTools" as never, next as never, { shouldDirty: true });
	};

	return (
		<div className="space-y-5 overflow-hidden">
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
			<DetectedVariablesPanel dynamic={dynamic} staticVars={staticVars} />

			{/* Static Variable Mapping — map {{vars}} to connected docs/skills */}
			{staticVars.length > 0 && (
				<div className="space-y-2 overflow-hidden">
					<div className="flex items-center justify-between">
						<Label className="text-xs text-zinc-400 flex items-center gap-1.5">
							<Link className="h-3 w-3" />
							Variable Mapping
						</Label>
						{availableResources.length > 0 && (
							<span className="text-[10px] text-zinc-500 shrink-0">
								{Object.keys(variableMappings).filter((k) => staticVars.includes(k) && variableMappings[k]).length} / {staticVars.length} mapped
							</span>
						)}
					</div>
					<p className="text-[11px] text-zinc-600">
						Map <code className="text-amber-400">{"{{"}</code>static<code className="text-amber-400">{"}}"}</code> variables to connected documents or skills.
					</p>
					<div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-3 space-y-2 overflow-hidden">
						{staticVars.map((varName) => {
							const currentValue = variableMappings[varName] ?? "";
							const isMapped = !!currentValue;
							const hasResources = availableResources.length > 0;
							return (
								<div key={varName} className="flex items-center gap-2 min-w-0 overflow-hidden">
									<span
										className="text-[11px] font-mono text-amber-300 bg-amber-950/40 border border-amber-800/30 px-1.5 py-0.5 rounded-md shrink-0 truncate max-w-[100px]"
										title={`{{${varName}}}`}
									>
										{`{{${varName}}}`}
									</span>
									<span className="text-[10px] text-zinc-600 shrink-0">→</span>
									{hasResources ? (
										<select
											value={currentValue}
											onChange={(e) => updateVarMapping(varName, e.target.value)}
											className={cn(
												"w-0 flex-1 rounded-lg bg-zinc-900/60 border text-xs font-mono h-8 px-2",
												isMapped
													? "border-amber-800/40 text-amber-200"
													: "border-zinc-700/60 text-zinc-500"
											)}
										>
											<option value="">— select —</option>
											{availableResources.filter((r) => r.kind === "doc").length > 0 && (
												<optgroup label="Documents">
													{availableResources
														.filter((r) => r.kind === "doc")
														.map((r) => (
															<option key={r.value} value={r.value}>
																{r.label}
															</option>
														))}
												</optgroup>
											)}
											{availableResources.filter((r) => r.kind === "skill").length > 0 && (
												<optgroup label="Skills">
													{availableResources
														.filter((r) => r.kind === "skill")
														.map((r) => (
															<option key={r.value} value={r.value}>
																{r.label}
															</option>
														))}
												</optgroup>
											)}
										</select>
									) : (
										<span className="flex-1 min-w-0 text-[11px] text-zinc-600 italic truncate">
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
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label className="text-xs text-zinc-400 flex items-center gap-1.5">
							<ArrowRight className="h-3 w-3" />
							Parameter Mapping
						</Label>
						<span className="text-[10px] text-zinc-500">
							{parameterMappings.filter(Boolean).length} mapped
						</span>
					</div>
					<p className="text-[11px] text-zinc-600">
						Map workflow-level values to this agent&apos;s positional parameters.
						Use <code className="text-blue-400">$N</code> for positional passthrough,{" "}
						<code className="text-amber-400">{"{{ref}}"}</code> for static refs, or a literal value.
					</p>
					<div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-3 space-y-2">
						{parameterMappings.map((value, index) => (
							<div key={index} className="flex items-center gap-2">
								<span className="text-[11px] font-mono text-zinc-500 w-14 shrink-0 text-right">
									→ ${index + 1}
								</span>
								<Input
									value={value}
									onChange={(e) => updateMapping(index, e.target.value)}
									placeholder={`e.g. $${index + 1}, {{name}}, or literal`}
									className={cn(
										"bg-zinc-900/60 border-zinc-700/60 rounded-lg text-xs font-mono h-8 flex-1",
										mappingValueClass(value)
									)}
								/>
								<button
									type="button"
									onClick={() => removeMappingSlot(index)}
									className="p-1 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-colors"
									title="Remove slot"
								>
									<Minus className="h-3.5 w-3.5" />
								</button>
							</div>
						))}
						<button
							type="button"
							onClick={addMappingSlot}
							className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mt-1"
						>
							<Plus className="h-3 w-3" />
							Add parameter slot
						</button>
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
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label>Disabled Tools</Label>
					<span className="text-[10px] text-zinc-500">
						{disabledTools.length === 0 ? "All enabled" : `${disabledTools.length} disabled`}
					</span>
				</div>
				<p className="text-xs text-zinc-600">Toggle off tools you want to disable for this agent.</p>
				<div className="grid grid-cols-3 gap-1.5">
					{AGENT_TOOLS.map((tool) => {
						const isDisabled = disabledTools.includes(tool);
						return (
							<button
								key={tool}
								type="button"
								onClick={() => toggleTool(tool)}
								className={cn(
									"flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-mono transition-all duration-150",
									isDisabled
										? "bg-red-950/50 border-red-800/50 text-red-400 line-through opacity-70"
										: "bg-zinc-800/50 border-zinc-700/50 text-zinc-300 hover:bg-zinc-700/50"
								)}
							>
								{tool}
							</button>
						);
					})}
				</div>
			</div>

			{/* Color */}
			<div className="space-y-2">
				<Label>Color</Label>
				<div className="flex flex-col gap-2">
					<div className="flex flex-wrap gap-2">
						{PRESET_COLORS.map((preset) => (
							<button
								key={preset}
								type="button"
								onClick={() => setValue("color" as never, preset as never, { shouldDirty: true })}
								className={cn(
									"w-7 h-7 rounded-full border-2 transition-all duration-150 hover:scale-110 flex items-center justify-center",
									color === preset
										? "border-white ring-2 ring-white/30 scale-110"
										: "border-transparent"
								)}
								style={{ backgroundColor: preset }}
								title={preset}
							>
								{color === preset && (
									<Check className="h-3 w-3 text-white/90 drop-shadow" />
								)}
							</button>
						))}
					</div>
					<div className="flex items-center gap-2">
						<Controller
							name="color"
							control={control}
							render={({ field }) => (
								<>
									<input
										type="color"
										value={field.value?.trim() ? field.value : NODE_ACCENT.agent}
										onChange={(e) => field.onChange(e.target.value)}
										className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-700/60 bg-transparent p-0.5"
										title="Custom color"
									/>
									<Input
										value={field.value?.trim() ? field.value : NODE_ACCENT.agent}
										onChange={(e) => field.onChange(e.target.value)}
										className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 font-mono text-xs uppercase"
										placeholder={NODE_ACCENT.agent}
										maxLength={7}
									/>
								</>
							)}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

