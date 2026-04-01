"use client";

import type { DragEvent } from "react";
import { useWorkflowStore } from "@/store/workflow";
import { BASIC_NODES, CONTROL_FLOW_NODES, type NodeRegistryEntry } from "@/lib/node-registry";
import {
  Menu,
  X,
  Braces,
  TerminalSquare,
  Shield,
  ShieldCheck,
  Handshake,
  Scale,
  Sparkles,
  Grip,
  CircleHelp,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BORDER_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_SUBTLE,
} from "@/lib/theme";
import {
  buildWorkflowIconToggleButtonClass,
  buildWorkflowPanelShellClass,
} from "./panel-primitives";
import { cn } from "@/lib/utils";

/** Node types that are disabled / coming soon */
const COMING_SOON_TYPES = new Set(["mcp-tool"]);

const COMING_SOON_BASIC = [
  { key: "variable", label: "Variable", description: "Store variables across nodes", icon: Braces, hex: "#84cc16" },
  { key: "command", label: "Command", description: "Reusable command", icon: TerminalSquare, hex: "#34d399" },
] as const;

const COMING_SOON_CONTROL = [
  { key: "validation", label: "Validation", description: "Check output of a branch", icon: ShieldCheck, hex: "#22d3ee" },
  { key: "guards", label: "Guards", description: "Add protective guardrails", icon: Shield, hex: "#38bdf8" },
  { key: "rules", label: "Rules", description: "Define reusable rules", icon: Scale, hex: "#f59e0b" },
  { key: "hands-off", label: "Hands Off", description: "Define handing off method", icon: Handshake, hex: "#fb7185" },
] as const;

const PANEL_SHELL_CLASS = buildWorkflowPanelShellClass("top-16 left-4");
const TOGGLE_BUTTON_CLASS = buildWorkflowIconToggleButtonClass(TEXT_MUTED);

type ComingSoonItem = (typeof COMING_SOON_BASIC)[number] | (typeof COMING_SOON_CONTROL)[number];

function CompactHelp({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-2 px-0.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {label}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-700/70 bg-zinc-950/70 text-zinc-500 transition-colors hover:border-zinc-600/80 hover:text-zinc-200"
              aria-label={`${label} help`}
            >
              <CircleHelp size={11} />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="start"
            sideOffset={8}
            className="max-w-55 rounded-xl border border-zinc-700/70 bg-zinc-900/95 px-3 py-2 text-[11px] leading-4 text-zinc-200 shadow-xl"
          >
            {description}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export default function NodePalette() {
  const sidebarOpen = useWorkflowStore((s) => s.sidebarOpen);
  const toggleSidebar = useWorkflowStore((s) => s.toggleSidebar);
  const setCurrentDraggedNodeType = useWorkflowStore((s) => s.setCurrentDraggedNodeType);

  const basicNodes = BASIC_NODES.filter((n) => n.type !== "start");
  const controlNodes = CONTROL_FLOW_NODES;

  const onDragStart = (event: DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.setData("text/plain", nodeType);
    event.dataTransfer.effectAllowed = "move";
    setCurrentDraggedNodeType(nodeType as import("@/types/workflow").NodeType);
  };

  const onDragEnd = () => {
    setCurrentDraggedNodeType(null);
  };

  const renderNodeItem = (node: NodeRegistryEntry) => {
    const Icon = node.icon;
    const isComingSoon = COMING_SOON_TYPES.has(node.type);

    return (
      <div
        key={node.type}
        draggable={!isComingSoon}
        onDragStart={isComingSoon ? undefined : (e) => onDragStart(e, node.type)}
        onDragEnd={isComingSoon ? undefined : onDragEnd}
        className={cn(
          "group relative flex items-center gap-2.5 overflow-hidden rounded-2xl border p-2.5 transition-all duration-200",
          isComingSoon
            ? "cursor-not-allowed select-none border-zinc-700/35 bg-zinc-900/45 opacity-60"
            : `${BORDER_MUTED} cursor-grab bg-zinc-900/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:-translate-y-0.5 hover:border-zinc-600/80 hover:bg-zinc-900/85 hover:shadow-[0_12px_28px_rgba(0,0,0,0.2)] active:cursor-grabbing`,
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-16 transition-opacity duration-200",
            isComingSoon ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          style={{ background: `linear-gradient(180deg, ${node.accentHex}${isComingSoon ? "14" : "22"} 0%, transparent 100%)` }}
        />

        <div
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/5"
          style={{ backgroundColor: `${node.accentHex}${isComingSoon ? "10" : "20"}` }}
        >
          <Icon size={16} style={{ color: node.accentHex }} className={isComingSoon ? "opacity-60" : ""} />
        </div>

        <div className="relative min-w-0 flex-1 space-y-0.5">
          <div className={cn(
            "truncate text-[13px] font-semibold",
            isComingSoon
              ? TEXT_SUBTLE
              : `${TEXT_SECONDARY} group-hover:text-white`,
          )}>
            {node.displayName}
          </div>
          <div className={cn(
            "line-clamp-1 text-[11px] leading-4",
            TEXT_SUBTLE,
          )}>
            {node.description}
          </div>
        </div>

        {isComingSoon && (
          <span className="relative shrink-0 rounded-full border border-zinc-600/50 bg-zinc-950/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            Soon
          </span>
        )}

        {!isComingSoon && (
          <div className="relative flex shrink-0 items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-950/75 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-500 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
            <Grip size={10} />
            Drag
          </div>
        )}
      </div>
    );
  };

  const renderComingSoonPlaceholder = (item: ComingSoonItem) => {
    const Icon = item.icon;

    return (
      <div
        key={item.key}
        className="relative flex items-center gap-2.5 overflow-hidden rounded-2xl border border-zinc-700/35 bg-zinc-900/45 p-2.5 opacity-60 cursor-not-allowed select-none transition-all duration-200"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16"
          style={{ background: `linear-gradient(180deg, ${item.hex}14 0%, transparent 100%)` }}
        />

        <div
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/5"
          style={{ backgroundColor: `${item.hex}10` }}
        >
          <Icon size={16} style={{ color: item.hex }} className="opacity-60" />
        </div>

        <div className="relative min-w-0 flex-1 space-y-0.5">
          <div className={`text-[13px] font-semibold ${TEXT_SUBTLE} truncate`}>
            {item.label}
          </div>
          <div className={`text-[11px] leading-4 ${TEXT_SUBTLE} line-clamp-1`}>
            {item.description}
          </div>
        </div>

        <span className="relative shrink-0 rounded-full border border-zinc-600/50 bg-zinc-950/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Soon
        </span>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      {/* Hamburger toggle — always visible in top-left */}
      <div className="nexus-no-select absolute top-4 left-4 z-30">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={TOGGLE_BUTTON_CLASS}
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </Button>
      </div>

      {/* Floating panel */}
      <div
        className={`${PANEL_SHELL_CLASS} ${
          sidebarOpen
            ? "opacity-100 translate-x-0 pointer-events-auto"
            : "opacity-0 -translate-x-4 pointer-events-none"
        } nexus-no-select`}
        style={{ width: "min(286px, calc(100vw - 32px))", height: "min(680px, calc(100vh - 112px))" }}
      >
        {/* Header */}
        <div className="border-b border-zinc-800/80 px-3 py-3 shrink-0">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-zinc-900/75 text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <Sparkles size={15} />
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${TEXT_PRIMARY}`}>Nodes</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700/70 bg-zinc-950/70 text-zinc-500 transition-colors hover:border-zinc-600/80 hover:text-zinc-200"
                    aria-label="Nodes panel help"
                  >
                    <CircleHelp size={12} />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="end"
                  sideOffset={8}
                  className="max-w-55 rounded-xl border border-zinc-700/70 bg-zinc-900/95 px-3 py-2 text-[11px] leading-4 text-zinc-200 shadow-xl"
                >
                  Drag blocks into the canvas to build your workflow. Switch tabs to browse core and control-flow nodes.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Tabs defaultValue="basic" className="flex-1 flex flex-col min-h-0">
            <div className="px-3 pt-3 shrink-0">
              <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <TabsTrigger
                  value="basic"
                  className={`flex-1 rounded-xl px-2.5 py-1.5 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-[0_8px_18px_rgba(0,0,0,0.22)] ${TEXT_SUBTLE} cursor-pointer text-[11px] font-medium`}
                >
                  Basic
                </TabsTrigger>
                <TabsTrigger
                  value="control"
                  className={`flex-1 rounded-xl px-2.5 py-1.5 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-[0_8px_18px_rgba(0,0,0,0.22)] ${TEXT_SUBTLE} cursor-pointer text-[11px] font-medium`}
                >
                  Control
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="basic" className="mt-0 flex-1 min-h-0 overflow-hidden data-[state=inactive]:hidden">
              <ScrollArea className="h-full min-h-0" viewportClassName="min-h-0">
                <div className="space-y-2.5 p-3 pb-4">
                  <CompactHelp
                    label="Basic"
                    description="Core building blocks for prompts, agents, skills, documents, scripts, and reusable workflow units."
                  />
                  {basicNodes.map(renderNodeItem)}
                  {COMING_SOON_BASIC.map(renderComingSoonPlaceholder)}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="control" className="mt-0 flex-1 min-h-0 overflow-hidden data-[state=inactive]:hidden">
              <ScrollArea className="h-full min-h-0" viewportClassName="min-h-0">
                <div className="space-y-2.5 p-3 pb-4">
                  <CompactHelp
                    label="Control"
                    description="Branch flows, route decisions, interaction checkpoints, and workflow exits inside the canvas."
                  />
                  {controlNodes.map(renderNodeItem)}
                  {COMING_SOON_CONTROL.map(renderComingSoonPlaceholder)}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}
