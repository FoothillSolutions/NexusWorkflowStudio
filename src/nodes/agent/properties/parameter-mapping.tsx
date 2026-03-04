"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, Minus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DYNAMIC_VAR_RE, STATIC_VAR_RE } from "@/nodes/shared/variable-utils";
import type { FormSetValue } from "@/nodes/shared/form-types";

interface ParameterMappingProps {
  parameterMappings: string[];
  dynamicVarCount: number;
  setValue: FormSetValue;
}

function mappingValueClass(value: string): string {
  const trimmed = value.trim();
  if (new RegExp(DYNAMIC_VAR_RE.source).test(trimmed)) return "text-blue-300";
  if (new RegExp(STATIC_VAR_RE.source).test(trimmed)) return "text-amber-300";
  if (trimmed) return "text-emerald-300";
  return "text-zinc-100";
}

export function ParameterMapping({ parameterMappings, dynamicVarCount, setValue }: ParameterMappingProps) {
  if (parameterMappings.length === 0 && dynamicVarCount === 0) return null;

  const update = (index: number, value: string) => {
    const next = [...parameterMappings];
    next[index] = value;
    setValue("parameterMappings" as never, next as never, { shouldDirty: true });
  };

  const add = () => {
    setValue("parameterMappings" as never, [...parameterMappings, ""] as never, { shouldDirty: true });
  };

  const remove = (index: number) => {
    setValue("parameterMappings" as never, parameterMappings.filter((_, i) => i !== index) as never, { shouldDirty: true });
  };

  const filledCount = parameterMappings.filter(Boolean).length;
  const allFilled = filledCount === parameterMappings.length && parameterMappings.length > 0;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-zinc-400 flex items-center gap-1.5">
          <ArrowRight className="h-3 w-3" />
          Parameter Mapping
        </Label>
        <span className={cn(
          "text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
          allFilled ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/30" : "text-zinc-500",
        )}>
          {filledCount} mapped
        </span>
      </div>
      <p className="text-[11px] text-zinc-500 leading-relaxed">
        Map workflow-level values to this agent&apos;s positional parameters.
        Use <code className="text-blue-400/80 font-semibold">$N</code> for positional passthrough,{" "}
        <code className="text-amber-400/80 font-semibold">{"{{ref}}"}</code> for static refs, or a literal value.
      </p>
      <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 overflow-hidden">
        <div className="divide-y divide-zinc-700/30">
          {parameterMappings.map((value, index) => (
            <div key={index} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-700/10 transition-colors">
              <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 w-10 h-6 flex items-center justify-center rounded-md shrink-0">
                ${index + 1}
              </span>
              <svg className="h-3 w-3 text-zinc-600 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 6h7M7 3.5 9.5 6 7 8.5" />
              </svg>
              <Input
                value={value}
                onChange={(e) => update(index, e.target.value)}
                placeholder={`e.g. $${index + 1}, {{name}}, or literal`}
                className={cn(
                  "bg-zinc-900/50 border-zinc-700/50 rounded-lg text-xs font-mono h-8 flex-1 transition-all",
                  "focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600",
                  mappingValueClass(value),
                )}
              />
              <button
                type="button"
                onClick={() => remove(index)}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/20 transition-all shrink-0"
                title="Remove slot"
              >
                <Minus className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="px-3 py-2 border-t border-zinc-700/30">
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors w-full justify-center py-0.5 rounded-lg hover:bg-zinc-700/10"
          >
            <Plus className="h-3 w-3" />
            Add parameter slot
          </button>
        </div>
      </div>
    </div>
  );
}

