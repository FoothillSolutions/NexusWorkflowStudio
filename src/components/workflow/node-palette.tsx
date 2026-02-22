"use client";

import { useWorkflowStore } from "@/store/workflow-store";
import { BASIC_NODES, CONTROL_FLOW_NODES, type NodeRegistryEntry } from "@/lib/node-types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BG_SURFACE,
  BORDER_DEFAULT,
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
        className={`flex items-center gap-3 p-3 rounded-md border ${BORDER_DEFAULT} ${BG_SURFACE} hover:${BG_SURFACE} hover:${BORDER_MUTED} cursor-grab active:cursor-grabbing transition-colors group`}
      >
        <div
          className="p-2 rounded-md"
          style={{ backgroundColor: `${node.accentHex}20` }}
        >
          <Icon size={20} style={{ color: node.accentHex }} />
        </div>
        <div>
          <div className={`text-sm font-medium ${TEXT_SECONDARY} group-hover:text-white`}>
            {node.displayName}
          </div>
          <div className={`text-xs ${TEXT_SUBTLE} line-clamp-1`}>
            {node.description}
          </div>
        </div>
      </div>
    );
  };

  if (!sidebarOpen) {
    return (
      <div className={`w-12 border-r ${BORDER_DEFAULT} ${BG_SURFACE}/80 flex flex-col items-center py-4 z-10 transition-all duration-300`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={`${TEXT_MUTED} hover:text-zinc-100`}
        >
          <ChevronRight size={20} />
        </Button>
      </div>
    );
  }

  return (
    <div className={`w-[280px] border-r ${BORDER_DEFAULT} ${BG_SURFACE}/80 flex flex-col z-10 transition-all duration-300`}>
      <div className={`flex items-center justify-between p-4 border-b ${BORDER_DEFAULT}`}>
        <span className={`text-sm font-semibold ${TEXT_SECONDARY}`}>Components</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={`h-8 w-8 ${TEXT_MUTED} hover:text-zinc-100`}
        >
          <ChevronLeft size={18} />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="basic" className="h-full flex flex-col">
          <div className="px-4 pt-4">
            <TabsList className={`w-full bg-zinc-950 border ${BORDER_DEFAULT}`}>
              <TabsTrigger
                value="basic"
                className={`flex-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 ${TEXT_SUBTLE} cursor-pointer`}
              >
                Basic
              </TabsTrigger>
              <TabsTrigger
                value="control"
                className={`flex-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 ${TEXT_SUBTLE} cursor-pointer`}
              >
                Control
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="basic" className="flex-1 overflow-y-auto p-4 space-y-3">
            {BASIC_NODES.filter((n) => n.type !== "start").map(renderNodeItem)}
          </TabsContent>

          <TabsContent value="control" className="flex-1 overflow-y-auto p-4 space-y-3">
            {CONTROL_FLOW_NODES.map(renderNodeItem)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
