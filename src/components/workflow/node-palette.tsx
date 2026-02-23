"use client";

import { useWorkflowStore } from "@/store/workflow-store";
import { BASIC_NODES, CONTROL_FLOW_NODES, type NodeRegistryEntry } from "@/lib/node-registry";
import { Menu, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BORDER_MUTED,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_SUBTLE,
} from "@/lib/theme";

export default function NodePalette() {
  const { sidebarOpen, toggleSidebar } = useWorkflowStore();

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const renderNodeItem = (node: NodeRegistryEntry) => {
    const Icon = node.icon;
    return (
      <div
        key={node.type}
        draggable
        onDragStart={(e) => onDragStart(e, node.type)}
        className={`flex items-center gap-3 p-3 rounded-xl border ${BORDER_MUTED} bg-zinc-800/60 hover:bg-zinc-700/60 hover:border-zinc-600 cursor-grab active:cursor-grabbing transition-all duration-200 group`}
      >
        <div
          className="p-2 rounded-lg shrink-0"
          style={{ backgroundColor: `${node.accentHex}20` }}
        >
          <Icon size={18} style={{ color: node.accentHex }} />
        </div>
        <div className="min-w-0">
          <div className={`text-sm font-medium ${TEXT_SECONDARY} group-hover:text-white truncate`}>
            {node.displayName}
          </div>
          <div className={`text-xs ${TEXT_SUBTLE} line-clamp-1`}>
            {node.description}
          </div>
        </div>
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
        className={`absolute top-16 left-4 z-20 flex flex-col rounded-2xl border border-zinc-700/50 bg-zinc-900/85 backdrop-blur-md shadow-2xl transition-all duration-300 ${
          sidebarOpen
            ? "w-[272px] opacity-100 pointer-events-auto"
            : "w-0 opacity-0 pointer-events-none"
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
            </TabsContent>

            <TabsContent value="control" className="flex-1 overflow-y-auto p-3 space-y-2 mt-0">
              {CONTROL_FLOW_NODES.map(renderNodeItem)}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
