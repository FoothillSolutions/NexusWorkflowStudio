"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubAgentModel, MODEL_DISPLAY_NAMES, MODEL_COST_MULTIPLIER } from "@/nodes/sub-agent/enums";

// ── Model groups by provider ────────────────────────────────────────────────

interface ModelEntry {
  value: SubAgentModel;
}

interface ModelGroup {
  label: string;
  color: string;       // dot color for the category
  textColor: string;   // label text color
  models: ModelEntry[];
}

const MODEL_GROUPS: ModelGroup[] = [
  {
    label: "Anthropic",
    color: "bg-orange-400",
    textColor: "text-orange-400/70",
    models: [
      { value: SubAgentModel.ClaudeHaiku45 },
      { value: SubAgentModel.ClaudeOpus41 },
      { value: SubAgentModel.ClaudeOpus45 },
      { value: SubAgentModel.ClaudeOpus46 },
      { value: SubAgentModel.ClaudeSonnet4 },
      { value: SubAgentModel.ClaudeSonnet45 },
      { value: SubAgentModel.ClaudeSonnet46 },
    ],
  },
  {
    label: "Google",
    color: "bg-blue-400",
    textColor: "text-blue-400/70",
    models: [
      { value: SubAgentModel.Gemini25Pro },
      { value: SubAgentModel.Gemini3FlashPreview },
      { value: SubAgentModel.Gemini3ProPreview },
      { value: SubAgentModel.Gemini31ProPreview },
    ],
  },
  {
    label: "OpenAI",
    color: "bg-emerald-400",
    textColor: "text-emerald-400/70",
    models: [
      { value: SubAgentModel.GPT41 },
      { value: SubAgentModel.GPT4o },
      { value: SubAgentModel.GPT5 },
      { value: SubAgentModel.GPT5Mini },
      { value: SubAgentModel.GPT51 },
      { value: SubAgentModel.GPT51Codex },
      { value: SubAgentModel.GPT51CodexMax },
      { value: SubAgentModel.GPT51CodexMini },
      { value: SubAgentModel.GPT52 },
      { value: SubAgentModel.GPT52Codex },
    ],
  },
];

// ── Cost badge ──────────────────────────────────────────────────────────────

function CostBadge({ cost }: { cost: number | undefined }) {
  const c = cost ?? 1.0;
  const color =
    c < 1
      ? "text-emerald-400"
      : c <= 1
        ? "text-zinc-500"
        : c <= 2
          ? "text-amber-400"
          : "text-red-400";

  const label =
    c < 1 ? `${c}x` : `${c.toFixed(1)}x`;

  return (
    <span className={cn("text-[11px] font-mono tabular-nums shrink-0", color)}>
      {label}
    </span>
  );
}

// ── ModelSelect ─────────────────────────────────────────────────────────────

interface ModelSelectProps {
  value: SubAgentModel;
  onChange: (value: SubAgentModel) => void;
}

export function ModelSelect({ value, onChange }: ModelSelectProps) {
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

  const displayName =
    value === SubAgentModel.Inherit
      ? MODEL_DISPLAY_NAMES[SubAgentModel.Inherit]
      : MODEL_DISPLAY_NAMES[value] ?? value;

  // Find which group the selected model belongs to
  const selectedGroup = MODEL_GROUPS.find((g) =>
    g.models.some((m) => m.value === value)
  );

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
        {value === SubAgentModel.Inherit ? (
          <Sparkles size={14} className="text-violet-400 shrink-0" />
        ) : selectedGroup ? (
          <span className={cn("w-2 h-2 rounded-full shrink-0", selectedGroup.color)} />
        ) : null}
        <span className="truncate text-left flex-1">{displayName}</span>
        {value !== SubAgentModel.Inherit && (
          <CostBadge cost={MODEL_COST_MULTIPLIER[value]} />
        )}
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
            "shadow-2xl shadow-black/50",
          )}
        >
          <div className="max-h-[380px] overflow-y-auto py-1">
            {/* Inherit option */}
            <button
              type="button"
              onClick={() => { onChange(SubAgentModel.Inherit); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors",
                "hover:bg-violet-500/10",
                value === SubAgentModel.Inherit
                  ? "text-violet-300 bg-violet-500/15 border-b border-violet-500/20"
                  : "text-zinc-400 border-b border-zinc-800/80"
              )}
            >
              <span className="w-[18px] flex items-center justify-center shrink-0">
                <Sparkles size={13} className="text-violet-400" />
              </span>
              <span className="flex-1 text-left font-medium">{MODEL_DISPLAY_NAMES[SubAgentModel.Inherit]}</span>
              {value === SubAgentModel.Inherit && (
                <Check size={14} className="text-violet-400 shrink-0" />
              )}
            </button>

            {/* Grouped models */}
            {MODEL_GROUPS.map((group) => (
              <div key={group.label}>
                {/* Category header */}
                <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", group.color)} />
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wider", group.textColor)}>
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-zinc-800/80" />
                </div>

                {/* Models in this group */}
                {group.models.map((m) => {
                  const isSelected = value === m.value;
                  const cost = MODEL_COST_MULTIPLIER[m.value];
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => { onChange(m.value); setOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] transition-colors",
                        "hover:bg-zinc-800/80",
                        isSelected
                          ? "text-zinc-100 bg-violet-500/8"
                          : "text-zinc-300"
                      )}
                    >
                      {/* Fixed-size alignment spacer for the check area */}
                      <span className="w-[18px] flex items-center justify-center shrink-0">
                        {isSelected && (
                          <Check size={13} className="text-violet-400" />
                        )}
                      </span>
                      <span className="flex-1 text-left truncate">
                        {MODEL_DISPLAY_NAMES[m.value]}
                      </span>
                      <CostBadge cost={cost} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
