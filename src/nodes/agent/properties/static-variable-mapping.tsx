"use client";

import { useCallback, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Check, ChevronDown, FileIcon, BoltIcon, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { FormSetValue } from "@/nodes/shared/form-types";
import type { AvailableResource } from "./use-connected-resources";

interface StaticVariableMappingProps {
  staticVars: string[];
  variableMappings: Record<string, string>;
  availableResources: AvailableResource[];
  setValue: FormSetValue;
}

export function StaticVariableMapping({
  staticVars, variableMappings, availableResources, setValue,
}: StaticVariableMappingProps) {
  const mappingsRef = useRef(variableMappings);
  useEffect(() => { mappingsRef.current = variableMappings; });

  const updateMapping = useCallback(
    (varName: string, value: string) => {
      const current = { ...mappingsRef.current };
      if (value) current[varName] = value;
      else delete current[varName];
      setValue("variableMappings" as never, current as never, { shouldDirty: true });
    },
    [setValue],
  );

  if (staticVars.length === 0) return null;

  const mappedCount = Object.keys(variableMappings).filter(
    (k) => staticVars.includes(k) && variableMappings[k],
  ).length;
  const allMapped = mappedCount === staticVars.length;
  const hasResources = availableResources.length > 0;
  const docs = availableResources.filter((r) => r.kind === "doc");
  const skills = availableResources.filter((r) => r.kind === "skill");

  return (
    <div className="space-y-2.5 overflow-hidden">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-zinc-400 flex items-center gap-1.5">
          <Link className="h-3 w-3" />
          Variable Mapping
        </Label>
        {hasResources && (
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
            allMapped
              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/30"
              : "text-zinc-500",
          )}>
            {mappedCount}/{staticVars.length} mapped
          </span>
        )}
      </div>
      <p className="text-[11px] text-zinc-500 leading-relaxed">
        Map <code className="text-amber-400/80 font-semibold">{"{{"}</code>static
        <code className="text-amber-400/80 font-semibold">{"}}"}</code> variables to connected documents or skills.
      </p>
      <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 divide-y divide-zinc-700/30 overflow-hidden">
        {staticVars.map((varName) => {
          const currentValue = variableMappings[varName] ?? "";
          const isMapped = !!currentValue;
          return (
            <div key={varName} className="flex items-center gap-2.5 px-3 py-2.5 min-w-0 overflow-hidden hover:bg-zinc-700/10 transition-colors">
              <span
                className={cn(
                  "text-[11px] font-mono px-2 py-1 rounded-lg shrink-0 truncate max-w-[110px] transition-colors",
                  isMapped
                    ? "text-amber-300 bg-amber-500/10 border border-amber-500/20"
                    : "text-amber-300/70 bg-amber-950/30 border border-amber-800/20",
                )}
                title={`{{${varName}}}`}
              >
                {`{{${varName}}}`}
              </span>
              <svg className="h-3 w-3 text-zinc-600 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 6h7M7 3.5 9.5 6 7 8.5" />
              </svg>
              {hasResources ? (
                <ResourceDropdown
                  currentValue={currentValue}
                  isMapped={isMapped}
                  docs={docs}
                  skills={skills}
                  onSelect={(v) => updateMapping(varName, v)}
                />
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
  );
}

function ResourceDropdown({
  currentValue, isMapped, docs, skills, onSelect,
}: {
  currentValue: string;
  isMapped: boolean;
  docs: AvailableResource[];
  skills: AvailableResource[];
  onSelect: (value: string) => void;
}) {
  const allResources = [...docs, ...skills];
  const displayLabel = isMapped
    ? allResources.find((r) => r.value === currentValue)?.label ?? currentValue
    : "Select resource…";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-0 flex-1 flex items-center justify-between rounded-lg border text-xs px-2.5 h-8 transition-all cursor-pointer truncate",
            "bg-zinc-900/50 hover:bg-zinc-800/60 focus:outline-none focus:ring-1 focus:ring-zinc-600",
            isMapped ? "border-amber-700/30 text-amber-200" : "border-zinc-700/50 text-zinc-500",
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-zinc-900 border-zinc-700/60">
        {isMapped && (
          <>
            <DropdownMenuItem onClick={() => onSelect("")} className="text-xs text-zinc-500 focus:bg-zinc-800 focus:text-zinc-300">
              Clear selection
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-700/40" />
          </>
        )}
        {docs.length > 0 && (
          <>
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Documents</DropdownMenuLabel>
            {docs.map((r) => (
              <DropdownMenuItem
                key={r.value}
                onClick={() => onSelect(r.value)}
                className={cn("text-xs gap-2 focus:bg-zinc-800", currentValue === r.value ? "text-amber-200 focus:text-amber-200" : "text-zinc-300 focus:text-zinc-100")}
              >
                <FileIcon className="h-3 w-3 text-yellow-500/70 shrink-0" />
                <span className="truncate flex-1">{r.label.replace(/^📄\s*/, "")}</span>
                {currentValue === r.value && <Check className="h-3 w-3 text-amber-400 shrink-0 ml-auto" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {docs.length > 0 && skills.length > 0 && <DropdownMenuSeparator className="bg-zinc-700/40" />}
        {skills.length > 0 && (
          <>
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Skills</DropdownMenuLabel>
            {skills.map((r) => (
              <DropdownMenuItem
                key={r.value}
                onClick={() => onSelect(r.value)}
                className={cn("text-xs gap-2 focus:bg-zinc-800", currentValue === r.value ? "text-amber-200 focus:text-amber-200" : "text-zinc-300 focus:text-zinc-100")}
              >
                <BoltIcon className="h-3 w-3 text-cyan-500/70 shrink-0" />
                <span className="truncate flex-1">{r.label.replace(/^⚡\s*/, "")}</span>
                {currentValue === r.value && <Check className="h-3 w-3 text-amber-400 shrink-0 ml-auto" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

