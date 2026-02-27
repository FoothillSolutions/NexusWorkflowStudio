"use client";

import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWorkflowStore } from "@/store/workflow-store";
import { throttledSave } from "@/lib/persistence";
import { toast } from "sonner";
import { BG_APP, TEXT_PRIMARY } from "@/lib/theme";
import Header from "./header";
import NodePalette from "./node-palette";
import Canvas from "./canvas";
import PropertiesPanel from "./properties-panel";
import DeleteDialog from "./delete-dialog";
import SavedWorkflowsSidebar from "./saved-workflows-sidebar";

export default function WorkflowEditor() {
  const {
    closePropertiesPanel,
    getWorkflowJSON,
  } = useWorkflowStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save: Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const data = getWorkflowJSON();
        // Since throttledSave is throttled, we might want a direct save here for user feedback
        // But for consistency with auto-save, we can use the same function or a direct call if we exposed saveToLocalStorage
        // For now, let's just trigger the throttled save and show toast
        throttledSave(data);
        toast.success("Workflow saved");
        return;
      }

      // Escape: Close properties panel
      if (e.key === "Escape") {
        closePropertiesPanel();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePropertiesPanel, getWorkflowJSON]);

  // Auto-save subscription
  useEffect(() => {
    const unsub = useWorkflowStore.subscribe((state) => {
        // We only want to save if the data changed.
        // The store changes on every mouse move (if we tracked viewport/nodes drag).
        // `throttledSave` handles the frequency.
        // We pass the current full state.
        const json = {
            name: state.name,
            nodes: state.nodes,
            edges: state.edges,
            ui: {
                sidebarOpen: state.sidebarOpen,
                minimapVisible: state.minimapVisible,
                viewport: state.viewport
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
            <PropertiesPanel />
          </div>
        </div>
        <DeleteDialog />
        <SavedWorkflowsSidebar />
      </div>
    </ReactFlowProvider>
  );
}
