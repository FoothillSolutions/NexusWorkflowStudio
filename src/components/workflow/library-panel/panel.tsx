"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Folders, LayoutGrid, Layers, RefreshCw, Search, X } from "lucide-react";
import { LIBRARY_CATEGORIES } from "@/lib/library";
import { TEXT_MUTED, TEXT_SUBTLE } from "@/lib/theme";
import {
  CATEGORY_ACCENT_HEX,
  CATEGORY_ICONS,
  PANEL_SHELL_CLASS,
  PANEL_SURFACE_CLASS,
} from "./constants";
import { EmptyState, LibraryItemCard, SectionHeader, WorkflowCard } from "./cards";
import { useLibraryPanelController } from "./use-library-panel-controller";
import type { LibraryPanelProps } from "./types";

export default function LibraryPanel(props: LibraryPanelProps) {
  const {
    activeCategory,
    activeCategoryLabel,
    categoryCounts,
    closeSidebar,
    confirmDelete,
    dismissDeleteDialog,
    executeDelete,
    filteredItems,
    filteredMarketplaceWorkflows,
    filteredWorkflows,
    handleLoadItem,
    handleLoadMarketplaceWorkflow,
    handleLoadWorkflow,
    handleUpdateWorkflow,
    hasItems,
    marketplaceRefreshing,
    requestLibraryItemDelete,
    requestWorkflowDelete,
    refreshMarketplaces,
    searchQuery,
    setActiveCategory,
    setSearchQuery,
    sidebarOpen,
  } = useLibraryPanelController(props);

  return (
    <>
      <div
        className={`${PANEL_SHELL_CLASS} ${
          sidebarOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-4 opacity-0"
        }`}
        style={{
          width: "min(420px, calc(100vw - 32px))",
          height: "calc(100vh - 112px)",
          maxHeight: "calc(100vh - 112px)",
        }}
      >
        <div className="shrink-0 border-b border-zinc-800/80 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-linear-to-br from-blue-500/15 to-violet-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <Folders className="h-4 w-4 text-blue-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-100">Library</span>
                <Badge
                  variant="outline"
                  className="rounded-full border-zinc-700/70 bg-zinc-950/70 px-2 py-0 text-[10px] font-medium text-zinc-400"
                >
                  {categoryCounts.all} total
                </Badge>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Browse saved workflows and reusable components
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refreshMarketplaces()}
                disabled={marketplaceRefreshing}
                className={`h-8 w-8 rounded-lg ${TEXT_MUTED} transition-colors hover:bg-zinc-800/80 hover:text-zinc-100`}
                title="Refresh marketplace items"
              >
                <RefreshCw size={14} className={marketplaceRefreshing ? "animate-spin" : ""} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeSidebar}
                className={`h-8 w-8 rounded-lg ${TEXT_MUTED} transition-colors hover:bg-zinc-800/80 hover:text-zinc-100`}
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-3 pb-3 pt-3">
          <div className={`${PANEL_SURFACE_CLASS} p-2.5`}>
            <div className="relative">
              <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${TEXT_SUBTLE}`} />
              <input
                type="text"
                placeholder="Search workflows and library items..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-700/50 bg-zinc-950/70 pl-9 pr-3 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-500 focus:border-zinc-600"
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 px-3 pb-3">
          <TooltipProvider delayDuration={150}>
            <div className={`${PANEL_SURFACE_CLASS} p-2`}>
              <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
                {LIBRARY_CATEGORIES.map(({ value, label }) => {
                  const isActive = activeCategory === value;
                  const count = categoryCounts[value] ?? 0;
                  const Icon = CATEGORY_ICONS[value] ?? LayoutGrid;
                  const hex = CATEGORY_ACCENT_HEX[value] ?? null;

                  return (
                    <Tooltip key={value}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setActiveCategory(value)}
                          className={`relative flex h-10 w-full items-center justify-center rounded-xl border transition-all duration-200 ease-out ${
                            isActive
                              ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                              : `border-transparent ${TEXT_SUBTLE} hover:border-zinc-700/70 hover:bg-zinc-800/70 hover:text-zinc-300`
                          }`}
                          style={
                            isActive
                              ? {
                                  backgroundColor: hex ? `${hex}14` : "rgba(63,63,70,0.7)",
                                  color: hex ?? "#e4e4e7",
                                  borderColor: hex ? `${hex}30` : "rgba(82,82,91,0.8)",
                                }
                              : undefined
                          }
                          aria-label={label}
                          title={label}
                        >
                          <Icon size={15} className="shrink-0" />
                          {count > 0 && (
                            <span className="absolute -right-1 -top-1 rounded-full border border-zinc-800 bg-zinc-900 px-1 text-[9px] font-semibold leading-4 text-zinc-300">
                              {count}
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-2">
                <div className="min-w-0 truncate text-xs font-medium text-zinc-200">
                  {activeCategoryLabel}
                </div>
                <div className="shrink-0 text-[10px] text-zinc-500">
                  {categoryCounts[activeCategory] ?? 0} item
                  {(categoryCounts[activeCategory] ?? 0) !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </TooltipProvider>
        </div>

        <div className="mx-3 border-t border-zinc-800/70" />

        <div className="flex min-h-0 flex-1">
          <ScrollArea className="min-h-0 w-full flex-1" viewportClassName="overscroll-contain [&>div]:!block">
            <div className="space-y-3 p-3.5">
              {!hasItems && <EmptyState category={activeCategory} />}

              {(filteredWorkflows.length > 0 || filteredMarketplaceWorkflows.length > 0) && (
                <>
                  {activeCategory === "all" && (
                    <SectionHeader
                      icon={Layers}
                      label="Workflows"
                      count={filteredWorkflows.length + filteredMarketplaceWorkflows.length}
                      accentClass="text-blue-300"
                    />
                  )}
                  {filteredWorkflows.map((entry) => (
                    <WorkflowCard
                      key={entry.id}
                      entry={entry}
                      onLoad={handleLoadWorkflow}
                      onUpdate={handleUpdateWorkflow}
                      onDelete={requestWorkflowDelete}
                    />
                  ))}
                  {filteredMarketplaceWorkflows.map((workflow) => (
                    <WorkflowCard
                      key={workflow.id}
                      entry={{
                        id: workflow.id,
                        name: workflow.name,
                        savedAt: workflow.savedAt,
                        updatedAt: workflow.updatedAt,
                        nodeCount: workflow.nodeCount,
                        edgeCount: workflow.edgeCount,
                        workflow: workflow.workflow,
                      }}
                      onLoad={() => handleLoadMarketplaceWorkflow(workflow)}
                      onUpdate={() => {}}
                      onDelete={() => {}}
                      readonly
                      marketplaceInfo={{
                        marketplaceName: workflow.marketplaceName,
                        pluginName: workflow.pluginName,
                      }}
                    />
                  ))}
                </>
              )}

              {filteredItems.length > 0 && (
                <>
                  {activeCategory === "all" &&
                    (filteredWorkflows.length > 0 || filteredMarketplaceWorkflows.length > 0) && (
                    <div className="mx-1 border-t border-zinc-800/70 pt-1" />
                  )}
                  {activeCategory === "all" && (
                    <SectionHeader
                      icon={LayoutGrid}
                      label="Components"
                      count={filteredItems.length}
                      accentClass="text-violet-300"
                    />
                  )}
                  {filteredItems.map((item) => {
                    const marketplaceItem = "readonly" in item && item.readonly ? item : null;

                    return (
                      <LibraryItemCard
                        key={item.id}
                        item={item}
                        onLoad={handleLoadItem}
                        onDelete={requestLibraryItemDelete}
                        readonly={!!marketplaceItem}
                        marketplaceInfo={
                          marketplaceItem
                            ? {
                                marketplaceName: marketplaceItem.marketplaceName,
                                pluginName: marketplaceItem.pluginName,
                              }
                            : undefined
                        }
                      />
                    );
                  })}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) dismissDeleteDialog();
        }}
        tone="danger"
        title={`Delete this ${confirmDelete?.type === "workflow" ? "workflow" : "item"}?`}
        description={
          confirmDelete ? (
            <>
              <span className="font-medium text-zinc-200">&ldquo;{confirmDelete.name}&rdquo;</span>{" "}
              will be permanently removed. This action cannot be undone.
            </>
          ) : undefined
        }
        confirmLabel="Delete"
        onConfirm={executeDelete}
      />
    </>
  );
}

