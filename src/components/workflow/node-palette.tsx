"use client";

import { useWorkflowStore } from "@/store/workflow-store";
import { BASIC_NODES, CONTROL_FLOW_NODES, type NodeRegistryEntry } from "@/lib/node-types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

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
        className="flex items-center gap-3 p-3 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700 cursor-grab active:cursor-grabbing transition-colors group"
      >
        <div
          className="p-2 rounded-md"
          style={{ backgroundColor: `${node.accentHex}20` }}
        >
          <Icon size={20} style={{ color: node.accentHex }} />
        </div>
        <div>
          <div className="text-sm font-medium text-zinc-200 group-hover:text-white">
            {node.displayName}
          </div>
          <div className="text-xs text-zinc-500 line-clamp-1">
            {node.description}
          </div>
        </div>
      </div>
    );
  };

  if (!sidebarOpen) {
    return (
      <div className="w-12 border-r border-zinc-800 bg-zinc-900/80 flex flex-col items-center py-4 z-10 transition-all duration-300">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="text-zinc-400 hover:text-zinc-100"
        >
          <ChevronRight size={20} />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-[280px] border-r border-zinc-800 bg-zinc-900/80 flex flex-col z-10 transition-all duration-300">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <span className="text-sm font-semibold text-zinc-200">Components</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
        >
          <ChevronLeft size={18} />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="basic" className="h-full flex flex-col">
          <div className="px-4 pt-4">
            <TabsList className="w-full bg-zinc-950 border border-zinc-800">
              <TabsTrigger
                value="basic"
                className="flex-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
              >
                Basic
              </TabsTrigger>
              <TabsTrigger
                value="control"
                className="flex-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
              >
                Control
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="basic" className="flex-1 overflow-y-auto p-4 space-y-3">
            {BASIC_NODES.map(renderNodeItem)}
          </TabsContent>

          <TabsContent value="control" className="flex-1 overflow-y-auto p-4 space-y-3">
            {CONTROL_FLOW_NODES.map(renderNodeItem)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
