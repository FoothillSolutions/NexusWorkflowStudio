import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { useKnowledgeStore } from "@/store/knowledge";
import { useSavedWorkflowsStore } from "@/store/library";
import { useWorkflowStore } from "@/store/workflow";

function resetPanelState() {
  useWorkflowStore.getState().reset();
  useSavedWorkflowsStore.setState({ sidebarOpen: false });
  useKnowledgeStore.setState({ panelOpen: false });
}

describe("workflow panel exclusivity", () => {
  beforeEach(() => {
    resetPanelState();
  });

  afterEach(() => {
    resetPanelState();
  });

  it("closes library and brain panels when opening properties", () => {
    useSavedWorkflowsStore.setState({ sidebarOpen: true });
    useKnowledgeStore.setState({ panelOpen: true });

    useWorkflowStore.getState().openPropertiesPanel("prompt-1");

    expect(useWorkflowStore.getState().selectedNodeId).toBe("prompt-1");
    expect(useWorkflowStore.getState().propertiesPanelOpen).toBe(true);
    expect(useSavedWorkflowsStore.getState().sidebarOpen).toBe(false);
    expect(useKnowledgeStore.getState().panelOpen).toBe(false);
  });

  it("closes properties and library when opening brain", () => {
    useWorkflowStore.setState({
      selectedNodeId: "prompt-1",
      propertiesPanelOpen: true,
    });
    useSavedWorkflowsStore.setState({ sidebarOpen: true });

    useKnowledgeStore.getState().openPanel();

    expect(useKnowledgeStore.getState().panelOpen).toBe(true);
    expect(useWorkflowStore.getState().propertiesPanelOpen).toBe(false);
    expect(useSavedWorkflowsStore.getState().sidebarOpen).toBe(false);
  });
});

