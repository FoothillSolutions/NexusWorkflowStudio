"use client";

import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWorkflowStore } from "@/store/workflow-store";
import { useSavedWorkflowsStore } from "@/store/library-store";
import { throttledSave, exportWorkflow } from "@/lib/persistence";
import { isModKey } from "@/lib/platform";
import { toast } from "sonner";
import { BG_APP, TEXT_PRIMARY } from "@/lib/theme";
import Header from "./header";
import NodePalette from "./node-palette";
import CanvasToolbar from "./canvas-toolbar";
import Canvas from "./canvas";
import PropertiesPanel from "./properties-panel";
import DeleteDialog from "./delete-dialog";
import LibraryPanel from "./library-panel";

export default function WorkflowEditor() {
  const {
    closePropertiesPanel,
    getWorkflowJSON,
    reset,
  } = useWorkflowStore();

  // Keyboard shortcuts (global — dialogs are managed by Header)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = isModKey(e);

      // ── ? → Show shortcuts dialog (? = Shift+/ on most keyboards) ──
      if (e.key === "?") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("nexus:open-shortcuts"));
        return;
      }

      // ── Mod+Shift+Z → Redo ──────────────────────────────────────
      if (mod && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        useWorkflowStore.temporal.getState().redo();
        return;
      }

      // ── Mod+Z → Undo ────────────────────────────────────────────
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        useWorkflowStore.temporal.getState().undo();
        return;
      }

      // ── Mod+S → Save to library ──────────────────────────────────
      if (mod && !e.altKey && !e.shiftKey && e.code === "KeyS") {
        e.preventDefault();
        const json = getWorkflowJSON();
        useSavedWorkflowsStore.getState().save(json);
        throttledSave(json);
        toast.success("Workflow saved to library");
        return;
      }

      // ── Mod+Alt+N → New workflow ──────────────────────────────────
      if (mod && e.altKey && e.code === "KeyN") {
        e.preventDefault();
        reset();
        useSavedWorkflowsStore.getState().clearActiveId();
        toast.success("New workflow created");
        return;
      }

      // ── Mod+Alt+E → Export workflow ────────────────────────────────
      if (mod && e.altKey && e.code === "KeyE") {
        e.preventDefault();
        exportWorkflow(getWorkflowJSON());
        toast.success("Workflow exported");
        return;
      }

      // ── Mod+Alt+O → Import workflow ────────────────────────────────
      if (mod && e.altKey && e.code === "KeyO") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("nexus:open-import"));
        return;
      }

      // ── Mod+Alt+G → Generate & download ───────────────────────────
      if (mod && e.altKey && e.code === "KeyG") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("nexus:generate"));
        return;
      }

      // ── Mod+Alt+P → Preview output ────────────────────────────────
      if (mod && e.altKey && e.code === "KeyP") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("nexus:open-preview"));
        return;
      }

      // ── Escape → Close properties panel ─────────────────────────
      if (e.key === "Escape") {
        closePropertiesPanel();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePropertiesPanel, getWorkflowJSON, reset]);

  // Auto-save subscription
  useEffect(() => {
    const unsub = useWorkflowStore.subscribe((state) => {
        const json = {
            name: state.name,
            nodes: state.nodes,
            edges: state.edges,
            ui: {
                sidebarOpen: state.sidebarOpen,
                minimapVisible: state.minimapVisible,
                viewport: state.viewport,
                canvasMode: state.canvasMode,
                edgeStyle: state.edgeStyle,
            }
        };
        throttledSave(json);
    });
    return () => unsub();
  }, []);

  return (
    <ReactFlowProvider>
      <div className={`flex h-screen flex-col ${BG_APP} ${TEXT_PRIMARY} font-sans`}>
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 relative">
            <Canvas />
            <NodePalette />
            <CanvasToolbar />
            <PropertiesPanel />
            <LibraryPanel />
          </div>
        </div>
        <DeleteDialog />
      </div>
    </ReactFlowProvider>
  );
}
