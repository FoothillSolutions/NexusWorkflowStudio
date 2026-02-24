"use client";
import { useEffect } from "react";
import { useWatch, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { detectVariables, DetectedVariablesPanel } from "@/nodes/shared/variable-utils";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";
import { SubAgentModel, SubAgentMemory, MODEL_DISPLAY_NAMES } from "./types";
import { AGENT_TOOLS, PRESET_COLORS } from "./constants";
import type { AgentTool } from "./constants";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const MODEL_GROUPS = [
	{
		label: "Anthropic Claude",
		options: [
			SubAgentModel.Haiku35,
			SubAgentModel.Sonnet35,
			SubAgentModel.Sonnet37,
			SubAgentModel.Opus4,
			SubAgentModel.Sonnet4,
		],
	},
	{
		label: "OpenAI",
		options: [
			SubAgentModel.GPT4o,
			SubAgentModel.GPT4oMini,
			SubAgentModel.O3,
			SubAgentModel.O3Mini,
			SubAgentModel.O4Mini,
		],
	},
	{
		label: "Google",
		options: [SubAgentModel.Gemini25Pro, SubAgentModel.Gemini25Flash],
	},
	{
		label: "xAI",
		options: [SubAgentModel.Grok3, SubAgentModel.Grok3Mini],
	},
	{
		label: "DeepSeek",
		options: [SubAgentModel.DeepSeekV3, SubAgentModel.DeepSeekR1],
	},
];

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
}

export function Fields({ control, setValue }: SubAgentFieldsProps) {
  const promptText: string  = useWatch({ control, name: "promptText" }) ?? "";
  const rawTemp             = useWatch({ control, name: "temperature" });
  const temperature         = rawTemp != null ? Number(rawTemp) : 0;
  const color: string       = useWatch({ control, name: "color" }) || "#5f27cd";
  const disabledTools: string[] = useWatch({ control, name: "disabledTools" }) ?? [];

	const { dynamic, static: staticVars } = detectVariables(promptText);
	const allVars = [...dynamic, ...staticVars];

	useEffect(() => {
		setValue("detectedVariables" as never, allVars as never, { shouldDirty: false });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [promptText]);

	const toggleTool = (tool: AgentTool) => {
		const next = disabledTools.includes(tool)
			? disabledTools.filter((t) => t !== tool)
			: [...disabledTools, tool];
		setValue("disabledTools" as never, next as never, { shouldDirty: true });
	};

	return (
		<div className="space-y-5">
			{/* Description */}
			<div className="space-y-2">
				<Label htmlFor="description">Description</Label>
				<Controller
					name="description"
					control={control}
					render={({ field }) => (
						<Textarea
							id="description"
							placeholder="What does this sub-agent do?"
							className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 min-h-[72px] resize-none text-sm"
							value={field.value ?? ""}
							onChange={field.onChange}
						/>
					)}
				/>
			</div>

			{/* Prompt */}
			<div className="space-y-2">
				<Label htmlFor="promptText">Prompt</Label>
				<Controller
					name="promptText"
					control={control}
					render={({ field }) => (
						<MarkdownEditor
							value={field.value ?? ""}
							onChange={field.onChange}
							height={180}
							placeholder="Enter your prompt here"
							hideToolbar
						/>
					)}
				/>
			</div>
			<DetectedVariablesPanel dynamic={dynamic} staticVars={staticVars} />

			{/* Model */}
			<div className="space-y-2">
				<Label htmlFor="model">Model</Label>
				<Controller
					name="model"
					control={control}
					render={({ field }) => (
						<select id="model" className={SELECT_CLASS} value={field.value} onChange={field.onChange}>
							<option value={SubAgentModel.Inherit}>{MODEL_DISPLAY_NAMES[SubAgentModel.Inherit]}</option>
							{MODEL_GROUPS.map((group) => (
								<optgroup key={group.label} label={group.label}>
									{group.options.map((m) => (
										<option key={m} value={m}>
											{MODEL_DISPLAY_NAMES[m]}
										</option>
									))}
								</optgroup>
							))}
						</select>
					)}
				/>
			</div>

			{/* Memory */}
			<div className="space-y-2">
				<Label htmlFor="memory">Memory</Label>
				<Controller
					name="memory"
					control={control}
					render={({ field }) => (
						<select id="memory" className={SELECT_CLASS} value={field.value} onChange={field.onChange}>
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
					<div className="grid grid-cols-5 gap-2">
						{PRESET_COLORS.map((preset) => (
							<button
								key={preset}
								type="button"
								onClick={() => setValue("color" as never, preset as never, { shouldDirty: true })}
								className={cn(
									"w-7 h-7 rounded-full border-2 transition-all duration-150 hover:scale-110",
									color === preset
										? "border-white ring-2 ring-white/30 scale-110"
										: "border-transparent"
								)}
								style={{ backgroundColor: preset }}
								title={preset}
							>
								{color === preset && (
									<Check className="h-3 w-3 text-white/90 mx-auto drop-shadow" />
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
										value={field.value?.trim() ? field.value : "#5f27cd"}
										onChange={(e) => field.onChange(e.target.value)}
										className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-700/60 bg-transparent p-0.5"
										title="Custom color"
									/>
									<Input
										value={field.value?.trim() ? field.value : "#5f27cd"}
										onChange={(e) => field.onChange(e.target.value)}
										className="bg-zinc-800/60 border-zinc-700/60 rounded-xl focus-visible:ring-zinc-600 font-mono text-xs uppercase"
										placeholder="#5f27cd"
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

