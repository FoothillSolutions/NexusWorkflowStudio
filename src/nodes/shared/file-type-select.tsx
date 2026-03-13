"use client";
import { useState, useRef, useEffect } from "react";
import {
	ChevronDown,
	Check,
	FileText,
	FileJson,
	FileCode,
	FileType,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentNodeData } from "@/nodes/document";

interface FileTypeOption {
	value: DocumentNodeData["fileExtension"];
	label: string;
	shortLabel: string;
	icon: LucideIcon;
	color: string;
}

// Node type options
export const FILE_TYPE_OPTIONS: FileTypeOption[] = [
	{ value: "md", label: ".md — Markdown", shortLabel: ".md", icon: FileText, color: "text-blue-400" },
	{ value: "txt", label: ".txt — Plain Text", shortLabel: ".txt", icon: FileType, color: "text-zinc-400" },
	{ value: "json", label: ".json — JSON", shortLabel: ".json", icon: FileJson, color: "text-yellow-400" },
	{ value: "yaml", label: ".yaml — YAML", shortLabel: ".yaml", icon: FileCode, color: "text-green-400" },
];

// ── FileTypeSelect ──────────────────────────────────────────────────────────

interface FileTypeSelectProps {
	value?: string;
	onChange: (value: DocumentNodeData["fileExtension"]) => void;
}

export function FileTypeSelect({ value, onChange }: FileTypeSelectProps) {
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Close on outside click
	useEffect(() => {
		if (!open) return;
		function handleClick(e: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open]);

	// Close on Escape
	useEffect(() => {
		if (!open) return;
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [open]);

	const selected = FILE_TYPE_OPTIONS.find((o) => o.value === value) ?? FILE_TYPE_OPTIONS[0];
	const Icon = selected.icon;

	return (
		<div ref={containerRef} className="relative">
			{/* Trigger */}
			<button
				type="button"
				onClick={() => setOpen((p) => !p)}
				className={cn(
					"w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5",
					"bg-zinc-800/60 border border-zinc-700/60",
					"text-sm text-zinc-100 transition-all duration-150",
					"hover:bg-zinc-800/80 hover:border-zinc-600/60",
					"focus:outline-none focus:ring-1 focus:ring-zinc-600",
					open && "ring-1 ring-zinc-600 bg-zinc-800/80"
				)}
			>
				<Icon size={14} className={cn("shrink-0", selected.color)} />
				<span className="truncate text-left flex-1">{selected.label}</span>
				<span className="text-[11px] font-mono text-zinc-500 shrink-0">{selected.shortLabel}</span>
				<ChevronDown
					size={14}
					className={cn(
						"text-zinc-500 shrink-0 transition-transform duration-150",
						open && "rotate-180"
					)}
				/>
			</button>

			{/* Dropdown */}
			{open && (
				<div
					className={cn(
						"absolute z-50 mt-1.5 w-full rounded-xl overflow-hidden",
						"bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/60",
						"shadow-2xl shadow-black/50"
					)}
				>
					<div className="py-1">
						{FILE_TYPE_OPTIONS.map((opt) => {
							const isSelected = value === opt.value;
							const OptIcon = opt.icon;
							return (
								<button
									key={opt.value}
									type="button"
									onClick={() => { onChange(opt.value); setOpen(false); }}
									className={cn(
										"w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors",
										"hover:bg-zinc-800/80",
										isSelected
											? "text-zinc-100 bg-violet-500/8"
											: "text-zinc-300"
									)}
								>
									<span className="w-4.5 flex items-center justify-center shrink-0">
										{isSelected ? (
											<Check size={13} className="text-violet-400" />
										) : (
											<OptIcon size={13} className={opt.color} />
										)}
									</span>
									<span className="flex-1 text-left">{opt.label}</span>
									<span className={cn("text-[11px] font-mono shrink-0", isSelected ? "text-violet-400" : "text-zinc-500")}>
										{opt.shortLabel}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
