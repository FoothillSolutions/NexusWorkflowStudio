"use client";

import { useCallback, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Check, ChevronDown, FileCode2, FileIcon, BoltIcon, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  staticVars,
  variableMappings,
  availableResources,
  setValue,
}: StaticVariableMappingProps) {
  const mappingsRef = useRef(variableMappings);

  useEffect(() => {
    mappingsRef.current = variableMappings;
  });

  const updateMapping = useCallback(
    (varName: string, value: string) => {
      const current = { ...mappingsRef.current };
      if (value) current[varName] = value;
      else delete current[varName];
      setValue("variableMappings" as never, current as never, {
        shouldDirty: true,
      });
    },
    [setValue],
  );

  if (staticVars.length === 0) return null;

  const mappedCount = Object.keys(variableMappings).filter(
    (key) => staticVars.includes(key) && variableMappings[key],
  ).length;
  const allMapped = mappedCount === staticVars.length;
  const hasResources = availableResources.length > 0;
  const docs = availableResources.filter((resource) => resource.kind === "doc");
  const skills = availableResources.filter((resource) => resource.kind === "skill");
  const scripts = availableResources.filter((resource) => resource.kind === "script");

  return (
    <div className="space-y-2.5 overflow-hidden">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Link className="h-3 w-3" />
          Variable Mapping
        </Label>
        {hasResources && (
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              allMapped
                ? "border border-emerald-800/30 bg-emerald-950/40 text-emerald-400"
                : "text-zinc-500",
            )}
          >
            {mappedCount}/{staticVars.length} mapped
          </span>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Map <code className="font-semibold text-amber-400/80">{"{{"}</code>static
        <code className="font-semibold text-amber-400/80">{"}}"}</code> variables to connected resources.
      </p>
      <div className="divide-y divide-zinc-700/30 overflow-hidden rounded-xl border border-zinc-700/40 bg-zinc-800/20">
        {staticVars.map((varName) => {
          const currentValue = variableMappings[varName] ?? "";
          const isMapped = !!currentValue;
          return (
            <div
              key={varName}
              className="flex min-w-0 items-center gap-2.5 overflow-hidden px-3 py-2.5 transition-colors hover:bg-zinc-700/10"
            >
              <span
                className={cn(
                  "max-w-27.5 shrink-0 truncate rounded-lg px-2 py-1 font-mono text-[11px] transition-colors",
                  isMapped
                    ? "border border-amber-500/20 bg-amber-500/10 text-amber-300"
                    : "border border-amber-800/20 bg-amber-950/30 text-amber-300/70",
                )}
                title={`{{${varName}}}`}
              >
                {`{{${varName}}}`}
              </span>
              <svg
                className="h-3 w-3 shrink-0 text-zinc-600"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 6h7M7 3.5 9.5 6 7 8.5" />
              </svg>
              {hasResources ? (
                <ResourceDropdown
                  currentValue={currentValue}
                  isMapped={isMapped}
                  docs={docs}
                  skills={skills}
                  scripts={scripts}
                  onSelect={(value) => updateMapping(varName, value)}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-[11px] italic text-zinc-500">
                  Connect a resource to map
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
  currentValue,
  isMapped,
  docs,
  skills,
  scripts,
  onSelect,
}: {
  currentValue: string;
  isMapped: boolean;
  docs: AvailableResource[];
  skills: AvailableResource[];
  scripts: AvailableResource[];
  onSelect: (value: string) => void;
}) {
  const allResources = [...docs, ...skills, ...scripts];
  const displayLabel = isMapped
    ? allResources.find((resource) => resource.value === currentValue)?.label ?? currentValue
    : "Select resource…";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 w-0 flex-1 cursor-pointer items-center justify-between truncate rounded-lg border px-2.5 text-xs transition-all",
            "bg-zinc-900/50 hover:bg-zinc-800/60 focus:outline-none focus:ring-1 focus:ring-zinc-600",
            isMapped
              ? "border-amber-700/30 text-amber-200"
              : "border-zinc-700/50 text-zinc-500",
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 border-zinc-700/60 bg-zinc-900">
        {isMapped && (
          <>
            <DropdownMenuItem
              onClick={() => onSelect("")}
              className="text-xs text-zinc-500 focus:bg-zinc-800 focus:text-zinc-300"
            >
              Clear selection
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-700/40" />
          </>
        )}
        {docs.length > 0 && (
          <>
            <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Documents
            </DropdownMenuLabel>
            {docs.map((resource) => (
              <DropdownMenuItem
                key={resource.value}
                onClick={() => onSelect(resource.value)}
                className={cn(
                  "gap-2 text-xs focus:bg-zinc-800",
                  currentValue === resource.value
                    ? "text-amber-200 focus:text-amber-200"
                    : "text-zinc-300 focus:text-zinc-100",
                )}
              >
                <FileIcon className="h-3 w-3 shrink-0 text-yellow-500/70" />
                <span className="flex-1 truncate">{resource.label.replace(/^📄\s*/, "")}</span>
                {currentValue === resource.value && (
                  <Check className="ml-auto h-3 w-3 shrink-0 text-amber-400" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {docs.length > 0 && skills.length > 0 && (
          <DropdownMenuSeparator className="bg-zinc-700/40" />
        )}
        {skills.length > 0 && (
          <>
            <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Skills
            </DropdownMenuLabel>
            {skills.map((resource) => (
              <DropdownMenuItem
                key={resource.value}
                onClick={() => onSelect(resource.value)}
                className={cn(
                  "gap-2 text-xs focus:bg-zinc-800",
                  currentValue === resource.value
                    ? "text-amber-200 focus:text-amber-200"
                    : "text-zinc-300 focus:text-zinc-100",
                )}
              >
                <BoltIcon className="h-3 w-3 shrink-0 text-cyan-500/70" />
                <span className="flex-1 truncate">{resource.label.replace(/^⚡\s*/, "")}</span>
                {currentValue === resource.value && (
                  <Check className="ml-auto h-3 w-3 shrink-0 text-amber-400" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {(docs.length > 0 || skills.length > 0) && scripts.length > 0 && (
          <DropdownMenuSeparator className="bg-zinc-700/40" />
        )}
        {scripts.length > 0 && (
          <>
            <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Scripts
            </DropdownMenuLabel>
            {scripts.map((resource) => (
              <DropdownMenuItem
                key={resource.value}
                onClick={() => onSelect(resource.value)}
                className={cn(
                  "gap-2 text-xs focus:bg-zinc-800",
                  currentValue === resource.value
                    ? "text-amber-200 focus:text-amber-200"
                    : "text-zinc-300 focus:text-zinc-100",
                )}
              >
                <FileCode2 className="h-3 w-3 shrink-0 text-sky-500/70" />
                <span className="flex-1 truncate">{resource.label.replace(/^🧩\s*/, "")}</span>
                {currentValue === resource.value && (
                  <Check className="ml-auto h-3 w-3 shrink-0 text-amber-400" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

