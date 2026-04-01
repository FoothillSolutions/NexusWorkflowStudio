import { describe, expect, it } from "bun:test";
import {
  LIBRARY_CATEGORIES,
  getAllLibraryItems,
  nodeTypeToCategory,
} from "../library";

describe("library metadata", () => {
  it("keeps library categories aligned with savable node categories", () => {
    expect(nodeTypeToCategory("agent")).toBe("agent");
    expect(nodeTypeToCategory("skill")).toBe("skill");
    expect(nodeTypeToCategory("document")).toBe("document");
    expect(nodeTypeToCategory("prompt")).toBe("prompt");
    expect(nodeTypeToCategory("script")).toBe("script");
    expect(nodeTypeToCategory("mcp-tool")).toBeNull();

    expect(LIBRARY_CATEGORIES.map((entry) => entry.value)).toEqual([
      "all",
      "workflow",
      "prompt",
      "script",
      "agent",
      "skill",
      "document",
    ]);
  });

  it("filters legacy unsupported library items from storage reads", () => {
    const key = "nexus-workflow-studio:library";
    const originalWindow = globalThis.window;
    const originalLocalStorage = globalThis.localStorage;
    const storage = new Map<string, string>();

    const mockLocalStorage = {
      getItem: (storageKey: string) => storage.get(storageKey) ?? null,
      setItem: (storageKey: string, value: string) => {
        storage.set(storageKey, value);
      },
      removeItem: (storageKey: string) => {
        storage.delete(storageKey);
      },
      clear: () => {
        storage.clear();
      },
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() {
        return storage.size;
      },
    } as Storage;

    Object.defineProperty(globalThis, "window", {
      value: { localStorage: mockLocalStorage },
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: mockLocalStorage,
      configurable: true,
    });

    mockLocalStorage.setItem(
      key,
      JSON.stringify([
        {
          id: "mcp-1",
          name: "Legacy MCP",
          category: "mcp-tool",
          nodeType: "mcp-tool",
          savedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          nodeData: { type: "mcp-tool", label: "Legacy MCP", name: "mcp-1", toolName: "legacy" },
        },
        {
          id: "prompt-1",
          name: "Reusable Prompt",
          category: "prompt",
          nodeType: "prompt",
          savedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          nodeData: { type: "prompt", label: "Prompt", name: "prompt-1", promptText: "hello" },
        },
      ]),
    );

    try {
      const items = getAllLibraryItems();
      expect(items.map((item) => item.id)).toEqual(["prompt-1"]);
      expect(JSON.parse(mockLocalStorage.getItem(key) ?? "[]")).toHaveLength(1);
    } finally {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
      Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        configurable: true,
      });
    }
  });
});

