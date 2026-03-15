"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Sparkles, Lock, Loader2, Search } from "lucide-react";
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
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { groups, isLoading, isDisabled } = useModels();

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
  const normalizedQuery = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return groups;
    return groups
      .map((group) => ({
        ...group,
        models: group.models.filter((m) => {
          const haystack = `${group.label} ${m.displayName} ${m.value}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.models.length > 0);
  }, [groups, normalizedQuery]);

  const getVisibleOptionsForQuery = (nextQuery: string) => {
    const normalized = nextQuery.trim().toLowerCase();
    const options: string[] = [];

    const nextShowInherit = !hideInherit && (!normalized || MODEL_DISPLAY_NAMES[SubAgentModel.Inherit].toLowerCase().includes(normalized));
    if (nextShowInherit) options.push(SubAgentModel.Inherit);

    for (const group of groups) {
      for (const model of group.models) {
        const haystack = `${group.label} ${model.displayName} ${model.value}`.toLowerCase();
        if (!normalized || haystack.includes(normalized)) {
          options.push(model.value);
        }
      }
    }

    return options;
  };

  const showInherit = !hideInherit && (!normalizedQuery || MODEL_DISPLAY_NAMES[SubAgentModel.Inherit].toLowerCase().includes(normalizedQuery));

  const visibleOptions = getVisibleOptionsForQuery(query);

  const closeDropdown = () => {
    setOpen(false);
    setQuery("");
    setHighlightedIndex(-1);
  };

  const selectModel = (nextValue: string) => {
    onChange(nextValue);
    closeDropdown();
  };

  // Find which group the selected model belongs to
  const selectedGroup = groups.find((g) =>
    g.models.some((m) => m.value === value)
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeDropdown();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open || highlightedIndex < 0) return;
    const id = requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-option-index="${highlightedIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, [open, highlightedIndex]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => {
          if (isDisabled) return;
          if (open) {
            closeDropdown();
            return;
          }
          const initialOptions = getVisibleOptionsForQuery("");
          const initialIndex = initialOptions.indexOf(value);
          setHighlightedIndex(initialIndex >= 0 ? initialIndex : initialOptions.length > 0 ? 0 : -1);
          setOpen(true);
        }}
        disabled={isDisabled}
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
      {open && !isDisabled && (
        <div
          className={cn(
            "absolute z-50 mt-1.5 w-full rounded-xl overflow-hidden",
            "bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/60",
            "shadow-2xl shadow-black/50",
          )}
        >
          <div
            ref={listRef}
            className="max-h-80 overflow-y-auto overscroll-contain py-1"
            onWheelCapture={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 px-2 pb-2 bg-zinc-900/95 backdrop-blur-xl">
              <div className="flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-800/70 px-2.5 py-2">
                <Search size={13} className="text-zinc-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    const nextQuery = e.target.value;
                    setQuery(nextQuery);
                    const nextOptions = getVisibleOptionsForQuery(nextQuery);
                    const nextIndex = nextOptions.indexOf(value);
                    setHighlightedIndex(nextIndex >= 0 ? nextIndex : nextOptions.length > 0 ? 0 : -1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      e.stopPropagation();
                      setHighlightedIndex((prev) => {
                        if (visibleOptions.length === 0) return -1;
                        return prev < 0 ? 0 : Math.min(prev + 1, visibleOptions.length - 1);
                      });
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      e.stopPropagation();
                      setHighlightedIndex((prev) => {
                        if (visibleOptions.length === 0) return -1;
                        return prev <= 0 ? 0 : prev - 1;
                      });
                      return;
                    }
                    if (e.key === "Enter") {
                      const nextValue = visibleOptions[highlightedIndex];
                      if (nextValue) {
                        e.preventDefault();
                        e.stopPropagation();
                        selectModel(nextValue);
                      }
                      return;
                    }
                    e.stopPropagation();
                  }}
                  placeholder="Search models..."
                  className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
                />
              </div>
            </div>

            {/* Inherit option */}
            {showInherit && (
              <button
                type="button"
                data-option-index={0}
                onMouseEnter={() => setHighlightedIndex(0)}
                onClick={() => selectModel(SubAgentModel.Inherit)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors",
                  "hover:bg-violet-500/10",
                  value === SubAgentModel.Inherit
                    ? "text-violet-300 bg-violet-500/15 border-b border-violet-500/20"
                    : "text-zinc-400 border-b border-zinc-800/80",
                  highlightedIndex === 0 && "bg-zinc-800/80"
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
            {filteredGroups.map((group) => (
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
                  const optionIndex = visibleOptions.indexOf(m.value);
                  return (
                    <button
                      key={m.value}
                      type="button"
                      data-option-index={optionIndex}
                      onMouseEnter={() => setHighlightedIndex(optionIndex)}
                      onClick={() => selectModel(m.value)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-1.75 text-[13px] transition-colors",
                        "hover:bg-zinc-800/80",
                        isSelected
                          ? "text-zinc-100 bg-violet-500/8"
                          : "text-zinc-300",
                        highlightedIndex === optionIndex && "bg-zinc-800/80"
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

            {!isLoading && groups.length > 0 && filteredGroups.length === 0 && normalizedQuery && (
              <div className="px-3 py-4 text-zinc-500 text-sm text-center">
                No models match “{query.trim()}”
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
