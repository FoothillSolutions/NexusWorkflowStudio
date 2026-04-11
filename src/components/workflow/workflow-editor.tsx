"use client";

import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWorkflowStore } from "@/store/workflow";
import { useSavedWorkflowsStore } from "@/store/library";
import { throttledSave, exportWorkflow, stripTransientProperties } from "@/lib/persistence";
import { isModKey } from "@/lib/platform";
import { toast } from "sonner";
import type { WorkflowJSON } from "@/types/workflow";
import { BG_APP, TEXT_PRIMARY } from "@/lib/theme";
import Header from "./header";
import NodePalette from "./node-palette";
import CanvasToolbar from "./canvas-toolbar";
import Canvas from "./canvas";
import PropertiesPanel from "./properties-panel";
import DeleteDialog from "./delete-dialog";
import LibraryPanel from "./library-panel";
import { BrainPanel } from "./brain-panel";
import SubWorkflowCanvas from "./sub-workflow-canvas";
import FloatingPromptGen from "./floating-prompt-gen";
import FloatingWorkflowGen from "./floating-workflow-gen";
import WhatsNewDialog from "./whats-new-dialog";
import { useWhatsNew } from "@/hooks/use-whats-new";
import { useCollaboration } from "./collaboration/use-collaboration";
import { CollabDoc } from "@/lib/collaboration";
import { buildWorkspaceRoomId } from "@/lib/collaboration/config";
import { useWorkspaceAutosave } from "@/hooks/use-workspace-autosave";
import { isSpacetimeConfigured } from "@/lib/spacetime/config";
import { spacetimeWorkspaceSync } from "@/lib/spacetime/workspace-sync";
import { spacetimeBrainSync } from "@/lib/spacetime/brain-sync";
import { spacetimePresence } from "@/lib/spacetime/presence";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  if (target.isContentEditable) return true;

  return !!target.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"]',
  );
}

export interface WorkflowEditorProps {
  workspaceId?: string;
  workflowId?: string;
  initialWorkflow?: WorkflowJSON;
}

export default function WorkflowEditor({
  workspaceId,
  workflowId,
  initialWorkflow,
}: WorkflowEditorProps = {}) {
  const isWorkspaceMode = Boolean(workspaceId && workflowId);

  const closePropertiesPanel = useWorkflowStore((s) => s.closePropertiesPanel);
  const getWorkflowJSON = useWorkflowStore((s) => s.getWorkflowJSON);
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);
  const refreshSaveState = useWorkflowStore((s) => s.refreshSaveState);
  const activeSubWorkflowNodeId = useWorkflowStore((s) => s.activeSubWorkflowNodeId);
  const openSubWorkflow = useWorkflowStore((s) => s.openSubWorkflow);
  const whatsNew = useWhatsNew();

  // Workspace mode: load initial workflow from server
  useEffect(() => {
    if (isWorkspaceMode && initialWorkflow) {
      loadWorkflow(initialWorkflow);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Workspace mode: auto-start sync (SpacetimeDB when configured, otherwise Y.js)
  useEffect(() => {
    if (!isWorkspaceMode || !workspaceId || !workflowId) return;

    if (isSpacetimeConfigured()) {
      // SpacetimeDB path: workspace sync + brain sync + presence
      spacetimeWorkspaceSync.startSync(workspaceId, workflowId, "Anonymous");
      spacetimeBrainSync.startBrainSync(workspaceId);
      spacetimePresence.startPresence(workspaceId, workflowId, "Anonymous");

      return () => {
        spacetimeWorkspaceSync.stopSync();
        spacetimeBrainSync.stopBrainSync();
        spacetimePresence.stopPresence();
      };
    }

    // Fallback: Y.js / Hocuspocus path
    const roomId = buildWorkspaceRoomId(workspaceId, workflowId);
    const doc = CollabDoc.getOrCreate();
    doc.start(roomId, getWorkflowJSON());

    return () => {
      CollabDoc.getInstance()?.destroy();
    };
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Standalone mode: collaboration via ?room= URL
  useCollaboration({ skip: isWorkspaceMode });

  // Auto-save to server in workspace mode (skip when SpacetimeDB handles persistence)
  const useSpacetime = isWorkspaceMode && isSpacetimeConfigured();
  useWorkspaceAutosave(
    isWorkspaceMode && !useSpacetime ? { workspaceId: workspaceId!, workflowId: workflowId!, displayName: "Anonymous" } : null,
  );

  // Report local selected node to remote peers via awareness (SpacetimeDB or Y.js)
  useEffect(() => {
    const unsub = useWorkflowStore.subscribe((state) => {
      if (useSpacetime) {
        spacetimePresence.updateSelection(state.selectedNodeId ?? null);
      } else {
        CollabDoc.getInstance()?.updateAwareness({ selectedNodeId: state.selectedNodeId });
      }
    });
    return () => unsub();
  }, [useSpacetime]);

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
      const isEditingText = isEditableTarget(e.target);

      // ── ? → Show shortcuts dialog (? = Shift+/ on most keyboards) ──
      if (e.key === "?") {
        if (isEditingText) return;
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("nexus:open-shortcuts"));
        return;
      }

      // ── Mod+Shift+Z → Redo ──────────────────────────────────────
      if (mod && e.shiftKey && e.key.toLowerCase() === "z") {
        if (isEditingText) return;
        e.preventDefault();
        useWorkflowStore.temporal.getState().redo();
        return;
      }

      // ── Mod+Z → Undo ────────────────────────────────────────────
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (isEditingText) return;
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
  // position updates. In workspace mode, skip localStorage persistence (server
  // auto-save handles it).
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
        // In workspace mode, skip localStorage save — server auto-save handles persistence
        if (!isWorkspaceMode) {
          throttledSave(snapshot);
        }
    });
    return () => unsub();
  }, [refreshSaveState, isWorkspaceMode]);

  return (
    <ReactFlowProvider>
      <div className={`flex h-screen min-w-0 flex-col ${BG_APP} ${TEXT_PRIMARY} font-sans`}>
        <Header
          workspaceContext={isWorkspaceMode ? { workspaceId: workspaceId!, workflowId: workflowId! } : undefined}
        />
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <div className="relative min-w-0 flex-1">
            <Canvas />
            <NodePalette />
            <CanvasToolbar />
            <PropertiesPanel />
            <FloatingPromptGen />
            <FloatingWorkflowGen />
            <LibraryPanel />
            <BrainPanel />
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
