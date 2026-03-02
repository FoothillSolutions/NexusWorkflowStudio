"use client";

import { useWorkflowStore } from "@/store/workflow-store";
import { BASIC_NODES, CONTROL_FLOW_NODES, type NodeRegistryEntry } from "@/lib/node-registry";
import { Menu, X, FileText, ScrollText, Scale, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BORDER_MUTED,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_SUBTLE,
} from "@/lib/theme";

/** Node types that are disabled / coming soon */
const COMING_SOON_TYPES = new Set(["mcp-tool"]);

/** Extra "coming soon" placeholders that aren't real node types */
const COMING_SOON_BASIC = [
  { key: "scripts",   label: "Scripts",   description: "Run custom scripts", icon: ScrollText,  hex: "#8b5cf6" },
];
const COMING_SOON_CONTROL = [
  { key: "rules",  label: "Rules",  description: "Define execution rules",  icon: Scale,       hex: "#f97316" },
  { key: "guards", label: "Guards", description: "Add safety guardrails",   icon: ShieldCheck, hex: "#22d3ee" },
];

export default function NodePalette() {
  const sidebarOpen = useWorkflowStore((s) => s.sidebarOpen);
  const toggleSidebar = useWorkflowStore((s) => s.toggleSidebar);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const renderNodeItem = (node: NodeRegistryEntry) => {
    const Icon = node.icon;
    const isComingSoon = COMING_SOON_TYPES.has(node.type);

    return (
      <div
        key={node.type}
        draggable={!isComingSoon}
        onDragStart={isComingSoon ? undefined : (e) => onDragStart(e, node.type)}
        className={
          isComingSoon
            ? `relative flex items-center gap-3 p-3 rounded-xl border border-zinc-700/30 bg-zinc-800/30 opacity-50 cursor-not-allowed select-none transition-all duration-200`
            : `flex items-center gap-3 p-3 rounded-xl border ${BORDER_MUTED} bg-zinc-800/60 hover:bg-zinc-700/60 hover:border-zinc-600 cursor-grab active:cursor-grabbing transition-all duration-200 group`
        }
      >
        <div
          className="p-2 rounded-lg shrink-0"
          style={{ backgroundColor: `${node.accentHex}${isComingSoon ? "10" : "20"}` }}
        >
          <Icon size={18} style={{ color: node.accentHex }} className={isComingSoon ? "opacity-50" : ""} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-medium ${isComingSoon ? TEXT_SUBTLE : TEXT_SECONDARY} ${!isComingSoon ? "group-hover:text-white" : ""} truncate`}>
            {node.displayName}
          </div>
          <div className={`text-xs ${TEXT_SUBTLE} line-clamp-1`}>
            {node.description}
          </div>
        </div>
        {isComingSoon && (
          <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-zinc-700/60 text-zinc-400 border border-zinc-600/40">
            Soon
          </span>
        )}
      </div>
    );
  };

  const renderComingSoonPlaceholder = (item: typeof COMING_SOON_BASIC[number]) => {
    const Icon = item.icon;
    return (
      <div
        key={item.key}
        className="relative flex items-center gap-3 p-3 rounded-xl border border-zinc-700/30 bg-zinc-800/30 opacity-50 cursor-not-allowed select-none transition-all duration-200"
      >
        <div
          className="p-2 rounded-lg shrink-0"
          style={{ backgroundColor: `${item.hex}10` }}
        >
          <Icon size={18} style={{ color: item.hex }} className="opacity-50" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-medium ${TEXT_SUBTLE} truncate`}>
            {item.label}
          </div>
          <div className={`text-xs ${TEXT_SUBTLE} line-clamp-1`}>
            {item.description}
          </div>
        </div>
        <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-zinc-700/60 text-zinc-400 border border-zinc-600/40">
          Soon
        </span>
      </div>
    );
  };

  return (
    <>
      {/* Hamburger toggle — always visible in top-left */}
      <div className="absolute top-4 left-4 z-30">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={`h-9 w-9 rounded-xl bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-sm shadow-lg ${TEXT_MUTED} hover:text-zinc-100 hover:bg-zinc-800/80 transition-all duration-200`}
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </Button>
      </div>

      {/* Floating panel */}
      <div
        className={`absolute top-16 left-4 z-20 flex flex-col w-[272px] rounded-2xl border border-zinc-700/50 bg-zinc-900/85 backdrop-blur-md shadow-2xl transition-all duration-300 ease-out ${
          sidebarOpen
            ? "opacity-100 translate-x-0 pointer-events-auto"
            : "opacity-0 -translate-x-4 pointer-events-none"
        }`}
        style={{ maxHeight: "calc(100vh - 112px)" }}
      >
        {/* Header */}
        <div className={`flex items-center px-4 py-3 border-b border-zinc-700/50 shrink-0`}>
          <span className={`text-sm font-semibold ${TEXT_SECONDARY}`}>Nodes</span>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Tabs defaultValue="basic" className="flex-1 flex flex-col min-h-0">
            <div className="px-3 pt-3 shrink-0">
              <TabsList className="w-full bg-zinc-950/70 border border-zinc-700/50 rounded-xl">
                <TabsTrigger
                  value="basic"
                  className={`flex-1 rounded-lg data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 ${TEXT_SUBTLE} cursor-pointer text-xs`}
                >
                  Basic
                </TabsTrigger>
                <TabsTrigger
                  value="control"
                  className={`flex-1 rounded-lg data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 ${TEXT_SUBTLE} cursor-pointer text-xs`}
                >
                  Control
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="basic" className="flex-1 overflow-y-auto p-3 space-y-2 mt-0">
              {BASIC_NODES.filter((n) => n.type !== "start").map(renderNodeItem)}
              {COMING_SOON_BASIC.map(renderComingSoonPlaceholder)}
            </TabsContent>

            <TabsContent value="control" className="flex-1 overflow-y-auto p-3 space-y-2 mt-0">
              {CONTROL_FLOW_NODES.map(renderNodeItem)}
              {COMING_SOON_CONTROL.map(renderComingSoonPlaceholder)}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
