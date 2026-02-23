"use client";

import { DollarSign, Braces } from "lucide-react";
import { Label } from "@/components/ui/label";

// ── Regex constants ─────────────────────────────────────────────────────────
export const DYNAMIC_VAR_RE = /\$(\d+)/g;
export const STATIC_VAR_RE = /\{\{([^}]+)}}/g;

// ── Detection helpers ───────────────────────────────────────────────────────
export function detectVariables(text: string): { dynamic: string[]; static: string[] } {
  const dynamic = [...new Set([...text.matchAll(DYNAMIC_VAR_RE)].map((m) => `$${m[1]}`))];
  const staticVars = [...new Set([...text.matchAll(STATIC_VAR_RE)].map((m) => m[1].trim()))];
  return { dynamic, static: staticVars };
}

export function detectVarCounts(text: string): { dynamic: number; static: number } {
  const dynamic = new Set([...text.matchAll(DYNAMIC_VAR_RE)].map((m) => m[1])).size;
  const staticCount = new Set([...text.matchAll(STATIC_VAR_RE)].map((m) => m[1].trim())).size;
  return { dynamic, static: staticCount };
}

// ── Shared UI: detected variable badges panel ───────────────────────────────
interface DetectedVariablesPanelProps {
  dynamic: string[];
  staticVars: string[];
}

export function DetectedVariablesPanel({ dynamic, staticVars }: DetectedVariablesPanelProps) {
  const total = dynamic.length + staticVars.length;
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <Label className="text-xs text-zinc-400">Detected Variables</Label>
      <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-3 space-y-2">
        {dynamic.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
              <DollarSign className="h-3 w-3" />
              Dynamic
            </div>
            <div className="flex flex-wrap gap-1">
              {dynamic.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center text-[11px] font-mono bg-blue-950/60 text-blue-300 border border-blue-800/40 px-2 py-0.5 rounded-md"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}
        {staticVars.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
              <Braces className="h-3 w-3" />
              Static References
            </div>
            <div className="flex flex-wrap gap-1">
              {staticVars.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center text-[11px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800/40 px-2 py-0.5 rounded-md"
                >
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

