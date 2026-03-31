"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentSubfolderSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}

export function DocumentSubfolderSelect({
  value,
  onChange,
  options,
}: DocumentSubfolderSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const selectedLabel = value || "Root docs folder";
  const selectedPath = value ? `docs/${value}/` : "docs/";

  return (
    <div ref={containerRef} className="relative">
      <button
        id="doc-subfolder"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left",
          "border border-zinc-700/60 bg-zinc-900/70 shadow-sm shadow-black/20",
          "transition-all duration-150 hover:border-zinc-600/70 hover:bg-zinc-900",
          "focus:outline-none focus:ring-1 focus:ring-yellow-500/40",
          open && "border-yellow-500/40 bg-zinc-900",
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-500/15 bg-yellow-500/10">
          <FolderOpen size={16} className="text-yellow-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-100">
            {selectedLabel}
          </div>
          <div className="truncate font-mono text-[11px] text-zinc-500">
            {selectedPath}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-zinc-500 transition-transform duration-150",
            open && "rotate-180 text-yellow-400",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-950/95 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="border-b border-zinc-800 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Select docs folder
          </div>
          <div className="max-h-56 overflow-y-auto py-1.5">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                value === ""
                  ? "bg-yellow-500/10 text-zinc-100"
                  : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100",
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80">
                {value === "" ? (
                  <Check size={13} className="text-yellow-400" />
                ) : (
                  <FolderOpen size={13} className="text-zinc-500" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  Root docs folder
                </span>
                <span className="block truncate font-mono text-[11px] text-zinc-500">
                  docs/
                </span>
              </span>
            </button>

            {options.map((folder) => {
              const isSelected = value === folder;
              return (
                <button
                  key={folder}
                  type="button"
                  onClick={() => {
                    onChange(folder);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "bg-yellow-500/10 text-zinc-100"
                      : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100",
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80">
                    {isSelected ? (
                      <Check size={13} className="text-yellow-400" />
                    ) : (
                      <FolderOpen size={13} className="text-yellow-500" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{folder}</span>
                    <span className="block truncate font-mono text-[11px] text-zinc-500">
                      docs/{folder}/
                    </span>
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

