"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Sparkles, Lock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubAgentModel, MODEL_DISPLAY_NAMES, MODEL_COST_MULTIPLIER } from "@/nodes/agent/enums";
import { useModels } from "@/hooks/use-models";

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
  value: string;
  onChange: (value: string) => void;
  /** When true, hides the "Inherit from workflow" option (useful outside node context). */
  hideInherit?: boolean;
}

export function ModelSelect({ value, onChange, hideInherit }: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | null>(null);
  const { groups, isLoading, isDisabled } = useModels();

  const updateDropdownPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 16;
    const gap = 6;
    const preferredMaxHeight = 380;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
    const availableAbove = rect.top - viewportPadding - gap;
    const openUpwards = availableBelow < 220 && availableAbove > availableBelow;
    const availableHeight = Math.max(
      120,
      Math.min(preferredMaxHeight, openUpwards ? availableAbove : availableBelow)
    );
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - viewportPadding - width
    );
    const top = openUpwards
      ? Math.max(viewportPadding, rect.top - gap - availableHeight)
      : Math.min(rect.bottom + gap, window.innerHeight - viewportPadding - availableHeight);

    setDropdownStyle({
      top,
      left,
      width,
      maxHeight: availableHeight,
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }

      if (containerRef.current) {
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

  useEffect(() => {
    if (!open) return;

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open, updateDropdownPosition]);

  // Resolve display name — prefer API data, fall back to static map, then raw value
  const resolveDisplayName = (modelValue: string): string => {
    if (!modelValue) return MODEL_DISPLAY_NAMES[SubAgentModel.Inherit];
    if (modelValue === SubAgentModel.Inherit) {
      return MODEL_DISPLAY_NAMES[SubAgentModel.Inherit];
    }
    // Try to find in dynamic groups
    for (const group of groups) {
      const found = group.models.find((m) => m.value === modelValue);
      if (found) return found.displayName;
    }
    // Fall back to static map
    if (MODEL_DISPLAY_NAMES[modelValue]) return MODEL_DISPLAY_NAMES[modelValue];
    // Last resort: show the raw "providerID/modelID" in a nicer way
    const parts = modelValue.split("/");
    return parts.length === 2 ? parts[1] : modelValue;
  };

  const displayName = resolveDisplayName(value);

  // Find which group the selected model belongs to
  const selectedGroup = groups.find((g) =>
    g.models.some((m) => m.value === value)
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !isDisabled && setOpen((p) => !p)}
        disabled={isDisabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5",
          "bg-zinc-800/60 border border-zinc-700/60",
          "text-sm text-zinc-100 transition-all duration-150",
          isDisabled
            ? "opacity-60 cursor-not-allowed"
            : "hover:bg-zinc-800/80 hover:border-zinc-600/60 focus:outline-none focus:ring-1 focus:ring-zinc-600",
          open && !isDisabled && "ring-1 ring-zinc-600 bg-zinc-800/80"
        )}
      >
        {isDisabled ? (
          <Lock size={14} className="text-zinc-500 shrink-0" />
        ) : value === SubAgentModel.Inherit ? (
          <Sparkles size={14} className="text-violet-400 shrink-0" />
        ) : selectedGroup ? (
          <span className={cn("w-2 h-2 rounded-full shrink-0", selectedGroup.color)} />
        ) : null}
        <span className="truncate text-left flex-1">{displayName}</span>
        {!isDisabled && value !== SubAgentModel.Inherit && (
          <CostBadge cost={MODEL_COST_MULTIPLIER[value]} />
        )}
        {isDisabled ? (
          <span className="text-[10px] text-zinc-500 font-medium shrink-0">Not connected</span>
        ) : isLoading ? (
          <Loader2 size={14} className="text-zinc-500 shrink-0 animate-spin" />
        ) : (
          <ChevronDown
            size={14}
            className={cn(
              "text-zinc-500 shrink-0 transition-transform duration-150",
              open && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Dropdown */}
      {open && !isDisabled && dropdownStyle && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className={cn(
            "fixed z-60 rounded-xl overflow-hidden",
            "bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/60",
            "shadow-2xl shadow-black/50",
          )}
        >
          <div className="custom-scroll overflow-y-auto overscroll-contain py-1" style={{ maxHeight: dropdownStyle.maxHeight }}>
            {/* Inherit option */}
            {!hideInherit && (
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
                <span className="w-4.5 flex items-center justify-center shrink-0">
                  <Sparkles size={13} className="text-violet-400" />
                </span>
                <span className="flex-1 text-left font-medium">{MODEL_DISPLAY_NAMES[SubAgentModel.Inherit]}</span>
                {value === SubAgentModel.Inherit && (
                  <Check size={14} className="text-violet-400 shrink-0" />
                )}
              </button>
            )}

            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center gap-2 px-3 py-4 text-zinc-500 text-sm">
                <Loader2 size={14} className="animate-spin" />
                <span>Loading models…</span>
              </div>
            )}

            {/* Grouped models */}
            {groups.map((group) => (
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
                        "w-full flex items-center gap-2.5 px-3 py-1.75 text-[13px] transition-colors",
                        "hover:bg-zinc-800/80",
                        isSelected
                          ? "text-zinc-100 bg-violet-500/8"
                          : "text-zinc-300"
                      )}
                    >
                      {/* Fixed-size alignment spacer for the check area */}
                      <span className="w-4.5 flex items-center justify-center shrink-0">
                        {isSelected && (
                          <Check size={13} className="text-violet-400" />
                        )}
                      </span>
                      <span className="flex-1 text-left truncate">
                        {m.displayName}
                      </span>
                      <CostBadge cost={cost} />
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Empty state when no groups and not loading */}
            {!isLoading && groups.length === 0 && (
              <div className="px-3 py-4 text-zinc-500 text-sm text-center">
                No models available
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
