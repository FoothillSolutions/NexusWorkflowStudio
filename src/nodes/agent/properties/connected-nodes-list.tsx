"use client";

import { Label } from "@/components/ui/label";
import { Zap, FileText, X } from "lucide-react";
import type { ConnectedNode } from "./use-connected-resources";

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
    getName: (d: Record<string, unknown>) => (d.skillName as string) || (d.label as string) || "",
    getSub: (d: Record<string, unknown>) => (d.projectName as string) || "",
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
    getName: (d: Record<string, unknown>) => {
      const name = (d.docName as string) || (d.label as string) || "";
      const ext = d.fileExtension as string;
      return ext ? `${name}.${ext}` : name;
    },
    getSub: () => "",
  },
} as const;

interface ConnectedNodesListProps {
  variant: "skill" | "doc";
  items: ConnectedNode[];
  onDeleteEdge: (edgeId: string) => void;
}

export function ConnectedNodesList({ variant, items, onDeleteEdge }: ConnectedNodesListProps) {
  if (items.length === 0) return null;

  const v = VARIANTS[variant];
  const Icon = v.icon;
  const label = variant === "skill" ? "Connected Skills" : "Connected Documents";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className={v.iconColor} />
        <Label className={v.labelColor}>{label} ({items.length})</Label>
      </div>
      <div className="flex flex-col gap-1">
        {items.map(({ edge, node }) => {
          const d = node.data as Record<string, unknown>;
          const name = v.getName(d) || node.id;
          const sub = v.getSub(d);
          return (
            <div key={node.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${v.bg} border ${v.border} text-xs min-w-0`}>
              <Icon size={10} className={`${v.itemIconColor} shrink-0`} />
              <span className={`${v.textColor} font-medium truncate min-w-0 flex-1`} title={name}>
                {name}
              </span>
              {sub && <span className={`${v.subtextColor} truncate ml-auto`}>{sub}</span>}
              <button
                type="button"
                onClick={() => onDeleteEdge(edge.id)}
                className="p-0.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-colors shrink-0 ml-auto"
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

