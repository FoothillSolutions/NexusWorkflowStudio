"use client";

import { Label } from "@/components/ui/label";
import { FileCode2, Zap, FileText, X } from "lucide-react";
import type { ConnectedNode } from "./use-connected-resources";
import { getDocumentDisplayPath } from "@/nodes/document/utils";
import { getSkillScriptBaseName, getSkillScriptFileName } from "@/nodes/skill/script-utils";

const VARIANTS = {
  skill: {
    icon: Zap,
    labelColor: "text-cyan-300",
    iconColor: "text-cyan-400",
    itemIconColor: "text-cyan-500",
    bg: "bg-cyan-950/30",
    border: "border-cyan-800/30",
    textColor: "text-cyan-200",
    subtextColor: "text-cyan-600",
    getName: (data: Record<string, unknown>) =>
      (data.skillName as string) || (data.label as string) || "",
    getSub: () => "",
  },
  doc: {
    icon: FileText,
    labelColor: "text-yellow-300",
    iconColor: "text-yellow-400",
    itemIconColor: "text-yellow-500",
    bg: "bg-yellow-950/30",
    border: "border-yellow-800/30",
    textColor: "text-yellow-200",
    subtextColor: "text-yellow-600",
    getName: (data: Record<string, unknown>) =>
      getDocumentDisplayPath(data as import("@/nodes/document/types").DocumentNodeData),
    getSub: () => "",
  },
  script: {
    icon: FileCode2,
    labelColor: "text-sky-300",
    iconColor: "text-sky-400",
    itemIconColor: "text-sky-500",
    bg: "bg-sky-950/30",
    border: "border-sky-800/30",
    textColor: "text-sky-200",
    subtextColor: "text-sky-600",
    getName: (data: Record<string, unknown>) => getSkillScriptFileName(data),
    getSub: (data: Record<string, unknown>) => `{{${getSkillScriptBaseName(data)}}}`,
  },
} as const;

interface ConnectedNodesListProps {
  variant: "skill" | "doc" | "script";
  items: ConnectedNode[];
  onDeleteEdge: (edgeId: string) => void;
}

export function ConnectedNodesList({
  variant,
  items,
  onDeleteEdge,
}: ConnectedNodesListProps) {
  if (items.length === 0) return null;

  const variantConfig = VARIANTS[variant];
  const Icon = variantConfig.icon;
  const label =
    variant === "skill"
      ? "Connected Skills"
      : variant === "doc"
        ? "Connected Documents"
        : "Connected Scripts";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className={variantConfig.iconColor} />
        <Label className={variantConfig.labelColor}>
          {label} ({items.length})
        </Label>
      </div>
      <div className="flex flex-col gap-1">
        {items.map(({ edge, node }) => {
          const data = node.data as Record<string, unknown>;
          const name = variantConfig.getName(data) || node.id;
          const sub = variantConfig.getSub(data);
          return (
            <div
              key={node.id}
              className={`flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${variantConfig.bg} ${variantConfig.border}`}
            >
              <Icon size={10} className={`${variantConfig.itemIconColor} shrink-0`} />
              <span
                className={`${variantConfig.textColor} min-w-0 flex-1 truncate font-medium`}
                title={name}
              >
                {name}
              </span>
              {sub && (
                <span className={`${variantConfig.subtextColor} ml-auto truncate`}>
                  {sub}
                </span>
              )}
              <button
                type="button"
                onClick={() => onDeleteEdge(edge.id)}
                className="ml-auto shrink-0 rounded-md p-0.5 text-zinc-600 transition-colors hover:bg-red-950/30 hover:text-red-400"
                title={`Remove ${variant} connection`}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

