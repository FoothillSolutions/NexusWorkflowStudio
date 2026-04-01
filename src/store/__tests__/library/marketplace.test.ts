import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  MarketplaceLibraryItem,
  MarketplaceWorkflowEntry,
} from "@/lib/marketplace/types";
import type { WorkflowJSON } from "@/types/workflow";
import { makeWorkflowNode } from "@/test-support/workflow-fixtures";
import { useSavedWorkflowsStore } from "../../library";
import { useWorkflowStore } from "../../workflow";

const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

const libraryActions = ((state) => ({
  refresh: state.refresh,
  save: state.save,
  remove: state.remove,
  rename: state.rename,
  duplicate: state.duplicate,
  load: state.load,
  clearActiveId: state.clearActiveId,
  toggleSidebar: state.toggleSidebar,
  openSidebar: state.openSidebar,
  closeSidebar: state.closeSidebar,
  setActiveCategory: state.setActiveCategory,
  saveNodeToLib: state.saveNodeToLib,
  removeLibraryItem: state.removeLibraryItem,
  renameLibraryItem: state.renameLibraryItem,
  fetchMarketplaceItems: state.fetchMarketplaceItems,
  refreshMarketplaces: state.refreshMarketplaces,
}))(useSavedWorkflowsStore.getState());

function resetLibraryStore() {
  useSavedWorkflowsStore.setState({
    entries: [],
    libraryItems: [],
    marketplaceItems: [],
    marketplaceWorkflows: [],
    marketplaceRefreshing: false,
    marketplaceError: null,
    activeCategory: "all",
    sidebarOpen: false,
    activeId: null,
    ...libraryActions,
  });
}

function makeWorkflowJson(name: string): WorkflowJSON {
  return {
    name,
    nodes: [
      makeWorkflowNode({
        id: `${name}-prompt`,
        data: {
          type: "prompt",
          label: name,
          name: `${name}-prompt`,
          promptText: "hello",
          detectedVariables: [],
        },
      }),
    ],
    edges: [],
    ui: {
      sidebarOpen: false,
      minimapVisible: true,
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

function makeMarketplaceItem(id = "mp:test:plugin:agent:item-1"): MarketplaceLibraryItem {
  const now = "2026-04-01T00:00:00.000Z";
  return {
    id,
    name: "Reusable Agent",
    category: "agent",
    nodeType: "agent",
    savedAt: now,
    updatedAt: now,
    nodeData: {
      type: "agent",
      label: "Reusable Agent",
      name: "plugin-agent",
      description: "Helpful agent",
      promptText: "Be helpful",
      detectedVariables: [],
      model: "inherit",
      memory: "-",
      temperature: 0,
      color: "#5f27cd",
      disabledTools: [],
      parameterMappings: [],
      variableMappings: {},
    },
    description: "Helpful agent",
    marketplaceName: "Test Marketplace",
    pluginName: "plugin-one",
    readonly: true as const,
  };
}

function makeMarketplaceWorkflow(id = "mp:test:plugin:workflow:wf-1"): MarketplaceWorkflowEntry {
  const now = "2026-04-01T00:00:00.000Z";
  const workflow = makeWorkflowJson("Marketplace Workflow");
  return {
    id,
    name: workflow.name,
    savedAt: now,
    updatedAt: now,
    nodeCount: workflow.nodes.length,
    edgeCount: workflow.edges.length,
    workflow,
    description: "Read-only workflow",
    marketplaceName: "Test Marketplace",
    pluginName: "plugin-one",
    readonly: true as const,
  };
}

describe("library store marketplace behavior", () => {
  beforeEach(() => {
    resetLibraryStore();
    useWorkflowStore.setState({ propertiesPanelOpen: false });
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  });

  afterEach(() => {
    resetLibraryStore();
    useWorkflowStore.setState({ propertiesPanelOpen: false });
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  });

  it("fetches marketplace items and workflows into store state", async () => {
    const items = [makeMarketplaceItem()];
    const workflows = [makeMarketplaceWorkflow()];
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/api/marketplaces/items");
      return {
        ok: true,
        status: 200,
        json: async () => ({ items, workflows, isRefreshing: false }),
      } as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await useSavedWorkflowsStore.getState().fetchMarketplaceItems();

    const state = useSavedWorkflowsStore.getState();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.marketplaceItems).toEqual(items);
    expect(state.marketplaceWorkflows).toEqual(workflows);
    expect(state.marketplaceRefreshing).toBe(false);
    expect(state.marketplaceError).toBeNull();
  });

  it("polls again while marketplace refresh is still running", async () => {
    const firstItems = [makeMarketplaceItem("mp:test:plugin:agent:first")];
    const secondItems = [makeMarketplaceItem("mp:test:plugin:agent:second")];
    const scheduled: Array<() => void> = [];
    let callCount = 0;

    globalThis.setTimeout = (((callback: TimerHandler) => {
      scheduled.push(callback as () => void);
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as unknown) as typeof setTimeout;
    globalThis.clearTimeout = mock(() => {}) as unknown as typeof clearTimeout;

    const fetchMock = mock(async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: firstItems, workflows: [], isRefreshing: true }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ items: secondItems, workflows: [], isRefreshing: false }),
      } as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await useSavedWorkflowsStore.getState().fetchMarketplaceItems();

    expect(useSavedWorkflowsStore.getState().marketplaceRefreshing).toBe(true);
    expect(scheduled).toHaveLength(1);

    scheduled[0]();
    await Promise.resolve();
    await Promise.resolve();

    const state = useSavedWorkflowsStore.getState();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state.marketplaceItems).toEqual(secondItems);
    expect(state.marketplaceRefreshing).toBe(false);
  });

  it("records a marketplace error when the items endpoint fails", async () => {
    const fetchMock = mock(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await useSavedWorkflowsStore.getState().fetchMarketplaceItems();

    const state = useSavedWorkflowsStore.getState();
    expect(state.marketplaceItems).toEqual([]);
    expect(state.marketplaceWorkflows).toEqual([]);
    expect(state.marketplaceRefreshing).toBe(false);
    expect(state.marketplaceError).toBe("HTTP 503");
  });

  it("refreshes marketplaces via POST then reloads marketplace items", async () => {
    const items = [makeMarketplaceItem()];
    const workflows = [makeMarketplaceWorkflow()];
    const calls: Array<{ input: string; method: string }> = [];
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ input: String(input), method });

      if (String(input) === "/api/marketplaces" && method === "POST") {
        return { ok: true, status: 202, json: async () => ({}) } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ items, workflows, isRefreshing: false }),
      } as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await useSavedWorkflowsStore.getState().refreshMarketplaces();

    expect(calls).toEqual([
      { input: "/api/marketplaces", method: "POST" },
      { input: "/api/marketplaces/items", method: "GET" },
    ]);
    expect(useSavedWorkflowsStore.getState().marketplaceItems).toEqual(items);
    expect(useSavedWorkflowsStore.getState().marketplaceWorkflows).toEqual(workflows);
    expect(useSavedWorkflowsStore.getState().marketplaceRefreshing).toBe(false);
  });

  it("opens the sidebar by closing the properties panel and loading marketplace items", async () => {
    const fetchMarketplaceItems = mock(async () => {});
    useSavedWorkflowsStore.setState({ fetchMarketplaceItems });
    useWorkflowStore.setState({ propertiesPanelOpen: true });

    useSavedWorkflowsStore.getState().openSidebar();

    expect(useSavedWorkflowsStore.getState().sidebarOpen).toBe(true);
    expect(useWorkflowStore.getState().propertiesPanelOpen).toBe(false);
    expect(fetchMarketplaceItems).toHaveBeenCalledTimes(1);
  });

  it("only reloads marketplace items when toggling the sidebar open", async () => {
    const fetchMarketplaceItems = mock(async () => {});
    useSavedWorkflowsStore.setState({ fetchMarketplaceItems, sidebarOpen: false });
    useWorkflowStore.setState({ propertiesPanelOpen: true });

    useSavedWorkflowsStore.getState().toggleSidebar();
    useSavedWorkflowsStore.getState().toggleSidebar();

    expect(fetchMarketplaceItems).toHaveBeenCalledTimes(1);
    expect(useSavedWorkflowsStore.getState().sidebarOpen).toBe(false);
    expect(useWorkflowStore.getState().propertiesPanelOpen).toBe(false);
  });
});


