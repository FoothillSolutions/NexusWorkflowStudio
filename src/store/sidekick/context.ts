import { useWorkflowStore } from "@/store/workflow";
import { useSavedWorkflowsStore } from "@/store/library";
import { useKnowledgeStore } from "@/store/knowledge";
import { useCollabStore } from "@/store/collaboration/collab-store";
import type { ToolResult } from "./types";

export function buildViewSnapshot(): string {
  const workflow = useWorkflowStore.getState();
  const library = useSavedWorkflowsStore.getState();
  const knowledge = useKnowledgeStore.getState();
  const collab = useCollabStore.getState();
  return `<view-snapshot>\nworkflow.name=${workflow.name}\nworkflow.dirty=${workflow.isDirty}\nworkflow.activeId=${library.activeId ?? ""}\nworkflow.nodes.count=${workflow.nodes.length}\nworkflow.edges.count=${workflow.edges.length}\nworkflow.selectedNodeId=${workflow.selectedNodeId ?? ""}\nview.subWorkflowDepth=${workflow.subWorkflowStack.length}\nview.activeSubWorkflowParentLabel=${workflow.subWorkflowStack.at(-1)?.label ?? ""}\nview.propertiesPanelOpen=${workflow.propertiesPanelOpen}\nview.libraryOpen=${library.sidebarOpen}\nview.knowledgePanelOpen=${knowledge.panelOpen}\nview.canvasMode=${workflow.canvasMode}\ncollab.inRoom=${Boolean(collab.roomId)}\ncollab.isOwner=${collab.isOwner}\n</view-snapshot>`;
}
export function buildToolResultMessage(results: ToolResult[]): string {
  return results.map((r) => `<tool-result id="${r.id}" name="${r.name}" ok="${r.ok}">\n${JSON.stringify(r.ok ? r.result ?? null : r.error ?? null, null, 2)}\n</tool-result>`).join("\n");
}
