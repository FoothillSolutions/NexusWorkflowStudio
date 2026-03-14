"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useOpenCodeStore } from "@/store/opencode-store";
import {
  loadCustomProjectDirs,
  addCustomProjectDir,
  removeCustomProjectDir,
  getActiveProjectDir,
  setActiveProjectDir,
} from "@/lib/persistence";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FolderOpen,
  ChevronDown,
  Check,
  FolderPlus,
  Trash2,
  Loader2,
  MapPin,
  FolderInput,
} from "lucide-react";
import { toast } from "sonner";
import { TEXT_MUTED } from "@/lib/theme";
import type { Project } from "@/lib/opencode/types";
import { useWorkflowGenStore } from "@/store/workflow-gen-store";

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function folderName(worktree: string): string {
  const segments = worktree.split(/[/\\]/).filter(Boolean);
  return segments.pop() ?? worktree;
}

function truncatePath(p: string, maxLen = 45): string {
  if (p.length <= maxLen) return p;
  const sep = p.includes("\\") ? "\\" : "/";
  const parts = p.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 3) return p;
  return `${parts[0]}${sep}…${sep}${parts[parts.length - 2]}${sep}${parts[parts.length - 1]}`;
}

/* ── Component ────────────────────────────────────────────────────────────── */

interface ProjectSwitcherProps {
  className?: string;
  variant?: "compact" | "default";
}

export function ProjectSwitcher({
  className,
  variant = "default",
}: ProjectSwitcherProps) {
  const status = useOpenCodeStore((s) => s.status);
  const client = useOpenCodeStore((s) => s.client);
  const currentProject = useOpenCodeStore((s) => s.currentProject);
  const fetchCurrentProject = useOpenCodeStore((s) => s.fetchCurrentProject);
  const isConnected = status === "connected";

  const [projects, setProjects] = useState<Project[]>([]);
  const [customDirs, setCustomDirs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeDir, setActiveDir] = useState<string | null>(null);

  // Load custom dirs + active dir from localStorage on mount (client only)
  useEffect(() => {
    setCustomDirs(loadCustomProjectDirs());
    setActiveDir(getActiveProjectDir());
  }, []);


  // Close on Escape
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [panelOpen]);

  // Fetch projects when panel opens
  const fetchProjects = useCallback(async () => {
    if (!client || !isConnected) return;
    setLoading(true);
    try {
      const [projectList] = await Promise.all([
        client.projects.list(),
        fetchCurrentProject(),
      ]);
      setProjects(projectList);
    } catch {
      toast.error("Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  }, [client, isConnected, fetchCurrentProject]);

  useEffect(() => {
    if (panelOpen && isConnected) {
      fetchProjects();
    }
  }, [panelOpen, isConnected, fetchProjects]);

  // Switch project
  const switchToProject = useCallback(
    (worktree: string) => {
      if (!client) return;
      client.http.defaultParams = { directory: worktree };
      setActiveProjectDir(worktree);
      setActiveDir(worktree);
      setPanelOpen(false);
      toast.success(`Switched to ${folderName(worktree)}`);
      // Update the store's current project
      fetchCurrentProject();
      // Dispose any existing AI workflow generation session so the new
      // directory gets a fresh context
      useWorkflowGenStore.getState().disposeSession();
    },
    [client, fetchCurrentProject],
  );

  // Browse folder via hidden <input webkitdirectory>
  const browseViaInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFolderSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // webkitRelativePath gives "folderName/..." — extract root segment
      const relativePath = files[0].webkitRelativePath;
      if (!relativePath) return;

      const rootFolder = relativePath.split("/")[0];
      if (rootFolder) {
        const dirs = addCustomProjectDir(rootFolder);
        setCustomDirs(dirs);
        toast.success(`Added "${rootFolder}"`);
      }
      e.target.value = "";
    },
    [],
  );

  // Manual path input (inline in footer)
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showManualInput) {
      setTimeout(() => manualInputRef.current?.focus(), 50);
    }
  }, [showManualInput]);

  const handleAddManualPath = useCallback(() => {
    const trimmed = manualPath.trim();
    if (!trimmed) return;
    const dirs = addCustomProjectDir(trimmed);
    setCustomDirs(dirs);
    setManualPath("");
    setShowManualInput(false);
    toast.success(`Added ${folderName(trimmed)}`);
  }, [manualPath]);

  // Remove custom dir
  const handleRemoveCustomDir = useCallback(
    (dir: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const dirs = removeCustomProjectDir(dir);
      setCustomDirs(dirs);
      toast("Removed custom location", { icon: "🗑️" });
    },
    [],
  );

  // Display name
  const displayName = currentProject
    ? folderName(currentProject.worktree)
    : activeDir
      ? folderName(activeDir)
      : "Projects";

  const isCompact = variant === "compact";
  const px = isCompact ? "px-2" : "px-2.5";

  const filteredProjects = projects.filter(
    (p) => p.worktree !== "/" && p.id !== "global",
  );

  return (
    <div className="relative">
      {/* Hidden file input for folder browsing */}
      <input
        ref={fileInputRef}
        type="file"
        /* @ts-expect-error -- webkitdirectory is non-standard but widely supported */
        webkitdirectory=""
        className="hidden"
        onChange={handleFolderSelected}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="sm"
            disabled={!isConnected}
            onClick={() => setPanelOpen((v) => !v)}
            className={`h-8 ${px} ${isCompact ? "text-xs gap-1 max-w-36" : "text-sm gap-1.5 max-w-50"} ${
              isConnected
                ? panelOpen
                  ? "text-zinc-100 bg-zinc-800"
                  : `${TEXT_MUTED} hover:text-zinc-100`
                : "text-zinc-600 cursor-not-allowed"
            } ${className ?? ""}`}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{displayName}</span>
            <ChevronDown
              className={`h-3 w-3 opacity-50 shrink-0 transition-transform ${
                panelOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isConnected
            ? "Switch project directory"
            : "Connect to opencode to switch projects"}
        </TooltipContent>
      </Tooltip>

      {/* ── Backdrop (dismiss on outside click) ────────────────── */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* ── Floating panel ───────────────────────────────────── */}
      {panelOpen && (
        <div
          ref={panelRef}
          className="absolute top-full right-0 mt-1.5 w-80 max-h-[min(460px,calc(100vh-80px))] rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/50 z-50 flex flex-col overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-150"
        >
          {/* ── Top: Add location actions ────────────────────── */}
          <div className="border-b border-zinc-800/80 p-1.5 shrink-0">
            {showManualInput ? (
              <div className="flex items-center gap-1.5 px-1">
                <div className="flex-1 relative">
                  <input
                    ref={manualInputRef}
                    type="text"
                    value={manualPath}
                    onChange={(e) => setManualPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddManualPath();
                      if (e.key === "Escape") {
                        setShowManualInput(false);
                        setManualPath("");
                      }
                    }}
                    placeholder="Paste path, e.g. D:\Projects\app"
                    className="w-full h-8 px-2.5 text-xs bg-zinc-950 border border-zinc-700 rounded-md text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-violet-500/60 transition-colors"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={!manualPath.trim()}
                  onClick={handleAddManualPath}
                  className="h-8 px-2.5 text-xs bg-violet-600 hover:bg-violet-500 text-white shrink-0"
                >
                  Add
                </Button>
                <button
                  onClick={() => {
                    setShowManualInput(false);
                    setManualPath("");
                  }}
                  className="h-8 px-2 text-xs text-zinc-500 hover:text-zinc-300 shrink-0"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={browseViaInput}
                  className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  <FolderInput className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs">Browse Folder…</span>
                </button>
                <div className="w-px h-5 bg-zinc-800" />
                <button
                  onClick={() => setShowManualInput(true)}
                  className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  <FolderPlus className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs">Paste Path…</span>
                </button>
              </div>
            )}
          </div>

          {/* Scrollable project list */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scroll">
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading projects…</span>
              </div>
            ) : (
              <div className="py-1">
                {/* ── OpenCode Projects ──────────────────────── */}
                {filteredProjects.length > 0 && (
                  <>
                    {filteredProjects.map((project) => {
                      const isCurrent = currentProject?.id === project.id;
                      const name =
                        project.name || folderName(project.worktree);
                      return (
                        <button
                          key={project.id}
                          onClick={() => switchToProject(project.worktree)}
                          className={`w-[calc(100%-8px)] mx-1 rounded-md px-2 py-2 text-left transition-colors group ${
                            isCurrent
                              ? "bg-emerald-500/10"
                              : "hover:bg-zinc-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 w-full min-w-0">
                            <div
                              className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                                isCurrent
                                  ? "bg-emerald-500/20"
                                  : "bg-zinc-800 group-hover:bg-zinc-700/80"
                              }`}
                            >
                              {project.icon?.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={project.icon.url}
                                  alt=""
                                  className="h-4 w-4 rounded-sm"
                                />
                              ) : (
                                <FolderOpen
                                  className={`h-3.5 w-3.5 ${
                                    isCurrent
                                      ? "text-emerald-400"
                                      : "text-zinc-500"
                                  }`}
                                />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span
                                className={`text-sm font-medium truncate ${
                                  isCurrent
                                    ? "text-emerald-400"
                                    : "text-zinc-200"
                                }`}
                              >
                                {name}
                              </span>
                              <span className="text-[10px] text-zinc-500 truncate leading-tight">
                                {truncatePath(project.worktree)}
                              </span>
                            </div>
                            {isCurrent && (
                              <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}

                {filteredProjects.length === 0 && customDirs.length === 0 && (
                  <div className="px-3 py-6 text-center">
                    <FolderOpen className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">No projects found</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      Add a custom location below
                    </p>
                  </div>
                )}

                {/* ── Custom Locations ───────────────────────── */}
                {customDirs.length > 0 && (
                  <>
                    {filteredProjects.length > 0 && (
                      <div className="mx-3 my-1 h-px bg-zinc-800/80" />
                    )}
                    <div className="px-3 py-1.5">
                      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                        Custom Locations
                      </span>
                    </div>
                    {customDirs.map((dir) => {
                      const isActive =
                        activeDir === dir ||
                        currentProject?.worktree === dir;
                      return (
                        <button
                          key={dir}
                          onClick={() => switchToProject(dir)}
                          className={`w-[calc(100%-8px)] mx-1 rounded-md px-2 py-2 text-left transition-colors group ${
                            isActive
                              ? "bg-blue-500/10"
                              : "hover:bg-zinc-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 w-full min-w-0">
                            <div
                              className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                                isActive
                                  ? "bg-blue-500/20"
                                  : "bg-zinc-800 group-hover:bg-zinc-700/80"
                              }`}
                            >
                              <MapPin
                                className={`h-3.5 w-3.5 ${
                                  isActive
                                    ? "text-blue-400"
                                    : "text-zinc-500"
                                }`}
                              />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span
                                className={`text-sm font-medium truncate ${
                                  isActive
                                    ? "text-blue-400"
                                    : "text-zinc-200"
                                }`}
                              >
                                {folderName(dir)}
                              </span>
                              <span className="text-[10px] text-zinc-500 truncate leading-tight">
                                {truncatePath(dir)}
                              </span>
                            </div>
                            <button
                              onClick={(e) => handleRemoveCustomDir(dir, e)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 hover:text-red-400 text-zinc-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                            {isActive && (
                              <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

