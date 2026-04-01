"use client";

import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWorkflowStore } from "@/store/workflow";
import { useSavedWorkflowsStore } from "@/store/library-store";
import { throttledSave, exportWorkflow, stripTransientProperties } from "@/lib/persistence";
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
import SubWorkflowCanvas from "./sub-workflow-canvas";
import FloatingPromptGen from "./floating-prompt-gen";
import FloatingWorkflowGen from "./floating-workflow-gen";
import WhatsNewDialog from "./whats-new-dialog";
import { useWhatsNew } from "@/hooks/use-whats-new";

export default function WorkflowEditor() {
  const closePropertiesPanel = useWorkflowStore((s) => s.closePropertiesPanel);
  const getWorkflowJSON = useWorkflowStore((s) => s.getWorkflowJSON);
  const refreshSaveState = useWorkflowStore((s) => s.refreshSaveState);
  const activeSubWorkflowNodeId = useWorkflowStore((s) => s.activeSubWorkflowNodeId);
  const openSubWorkflow = useWorkflowStore((s) => s.openSubWorkflow);
  const whatsNew = useWhatsNew();

  // Listen for sub-workflow open events from properties panel
  useEffect(() => {
    const handler = (e: Event) => {
      const nodeId = (e as CustomEvent).detail?.nodeId;
      if (nodeId) openSubWorkflow(nodeId);
    };
    window.addEventListener("nexus:open-sub-workflow", handler);
    return () => window.removeEventListener("nexus:open-sub-workflow", handler);
  }, [openSubWorkflow]);

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
        window.dispatchEvent(new CustomEvent("nexus:new-workflow-request"));
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

      // ── Mod+Alt+G → Open generated file export ────────────────────
      if (mod && e.altKey && e.code === "KeyG") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("nexus:generate"));
        return;
      }

      // ── Mod+Alt+A → AI Workflow Generation ─────────────────────────
      if (mod && e.altKey && e.code === "KeyA") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("nexus:open-workflow-gen"));
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
        // If sub-workflow is open, the sub-workflow canvas handles Escape
        if (useWorkflowStore.getState().activeSubWorkflowNodeId) return;
        closePropertiesPanel();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePropertiesPanel, getWorkflowJSON]);

  // Auto-save subscription — only reacts to data changes, not high-frequency
  // position updates. We compare references so that dragging (which creates a
  // new nodes array on every frame) still triggers a save eventually via the
  // trailing edge of the throttle, but we avoid constructing the full JSON
  // object synchronously on every single frame.
  useEffect(() => {
    let prevNodes = useWorkflowStore.getState().nodes;
    let prevEdges = useWorkflowStore.getState().edges;
    let prevName = useWorkflowStore.getState().name;

    const unsub = useWorkflowStore.subscribe((state) => {
        // Skip if nothing we care about changed
        if (
          state.nodes === prevNodes &&
          state.edges === prevEdges &&
          state.name === prevName
        ) return;

        prevNodes = state.nodes;
        prevEdges = state.edges;
        prevName = state.name;

        const snapshot = stripTransientProperties({
          name: state.name,
          nodes: state.nodes,
          edges: state.edges,
          ui: {
            sidebarOpen: state.sidebarOpen,
            minimapVisible: state.minimapVisible,
            viewport: state.viewport,
            canvasMode: state.canvasMode,
            edgeStyle: state.edgeStyle,
          },
        });

        refreshSaveState(snapshot);
        // Throttle will coalesce rapid position updates into one trailing save
        throttledSave(snapshot);
    });
    return () => unsub();
  }, [refreshSaveState]);

  return (
    <ReactFlowProvider>
      <div className={`flex h-screen min-w-0 flex-col ${BG_APP} ${TEXT_PRIMARY} font-sans`}>
        <Header />
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <div className="relative min-w-0 flex-1">
            <Canvas />
            <NodePalette />
            <CanvasToolbar />
            <PropertiesPanel />
            <FloatingPromptGen />
            <FloatingWorkflowGen />
            <LibraryPanel />
          </div>
        </div>
        <DeleteDialog />
        <WhatsNewDialog open={whatsNew.open} onDismiss={whatsNew.dismiss} />
        {/* Sub-workflow editor overlay */}
        {activeSubWorkflowNodeId && (
          <SubWorkflowCanvas key={activeSubWorkflowNodeId} nodeId={activeSubWorkflowNodeId} />
        )}
      </div>
    </ReactFlowProvider>
  );
}
