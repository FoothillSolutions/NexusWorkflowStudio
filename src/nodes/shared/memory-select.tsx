"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, CircleSlash, User, Folder, FolderLock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubAgentMemory } from "@/nodes/agent/enums";

interface MemoryOption {
  value: SubAgentMemory;
  label: string;
  description: string;
  icon: typeof User;
  iconColor: string;
}

const MEMORY_OPTIONS: MemoryOption[] = [
  {
    value: SubAgentMemory.Default,
    label: "None",
    description: "No persistent memory",
    icon: CircleSlash,
    iconColor: "text-zinc-500",
  },
  {
    value: SubAgentMemory.Project,
    label: "Project",
    description: "Shared via version control",
    icon: Folder,
    iconColor: "text-emerald-400",
  },
  {
    value: SubAgentMemory.Local,
    label: "Local",
    description: "Project-scoped, not checked in",
    icon: FolderLock,
    iconColor: "text-amber-400",
  },
  {
    value: SubAgentMemory.User,
    label: "User",
    description: "Shared across all projects",
    icon: User,
    iconColor: "text-violet-400",
  },
];

const OPTIONS_BY_VALUE = new Map(MEMORY_OPTIONS.map((o) => [o.value, o]));

interface MemorySelectProps {
  value: SubAgentMemory | string | null | undefined;
  onChange: (value: SubAgentMemory) => void;
}

export function MemorySelect({ value, onChange }: MemorySelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | null>(null);

  const selected = OPTIONS_BY_VALUE.get((value ?? SubAgentMemory.Default) as SubAgentMemory)
    ?? OPTIONS_BY_VALUE.get(SubAgentMemory.Default)!;
  const SelectedIcon = selected.icon;

  const updateDropdownPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 16;
    const gap = 6;
    const preferredMaxHeight = 280;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
    const availableAbove = rect.top - viewportPadding - gap;
    const openUpwards = availableBelow < 180 && availableAbove > availableBelow;
    const availableHeight = Math.max(
      120,
      Math.min(preferredMaxHeight, openUpwards ? availableAbove : availableBelow),
    );
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - viewportPadding - width,
    );
    const top = openUpwards
      ? Math.max(viewportPadding, rect.top - gap - availableHeight)
      : Math.min(rect.bottom + gap, window.innerHeight - viewportPadding - availableHeight);

    setDropdownStyle({ top, left, width, maxHeight: availableHeight });
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

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

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5",
          "bg-zinc-800/60 border border-zinc-700/60",
          "text-sm text-zinc-100 transition-all duration-150",
          "hover:bg-zinc-800/80 hover:border-zinc-600/60 focus:outline-none focus:ring-1 focus:ring-zinc-600",
          open && "ring-1 ring-zinc-600 bg-zinc-800/80",
        )}
      >
        <SelectedIcon size={14} className={cn("shrink-0", selected.iconColor)} />
        <span className="truncate text-left flex-1">{selected.label}</span>
        <ChevronDown
          size={14}
          className={cn(
            "text-zinc-500 shrink-0 transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {open && dropdownStyle && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className={cn(
            "fixed z-60 rounded-xl overflow-hidden",
            "bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/60",
            "shadow-2xl shadow-black/50",
          )}
        >
          <div
            className="custom-scroll overflow-y-auto overscroll-contain py-1"
            style={{ maxHeight: dropdownStyle.maxHeight }}
          >
            {MEMORY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selected.value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-start gap-3 px-3.5 py-2.5 text-sm transition-colors",
                    "hover:bg-zinc-800/80",
                    isSelected ? "text-zinc-100 bg-violet-500/8" : "text-zinc-300",
                  )}
                >
                  <Icon size={14} className={cn("shrink-0 mt-0.5", opt.iconColor)} />
                  <span className="flex-1 text-left min-w-0">
                    <span className="block font-medium leading-snug">{opt.label}</span>
                    <span className="block text-[11px] text-zinc-500 leading-snug mt-0.5">
                      {opt.description}
                    </span>
                  </span>
                  <span className="w-4 flex items-center justify-center shrink-0 mt-0.5">
                    {isSelected && <Check size={13} className="text-violet-400" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
