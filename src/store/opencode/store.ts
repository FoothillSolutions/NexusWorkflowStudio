import { create } from "zustand";
import {
  createOpenCodeClient,
  type OpenCodeClient,
  OpenCodeError,
} from "@/lib/opencode";
import { loadOpenCodeUrl, saveOpenCodeUrl } from "@/lib/opencode/config";
import type { Project } from "@/lib/opencode/types";
import { buildModelGroups, type ModelGroup } from "./models";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

// ── Health-check heartbeat ───────────────────────────────────────────────────
// Pings the server every HEARTBEAT_MS while connected.  If the check fails the
// status flips to "error".  If a previous error/disconnect recovers, we silently
// restore the "connected" state without a full reconnect.

const HEARTBEAT_MS = 30_000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(async () => {
    const { client, status } = useOpenCodeStore.getState();
    if (!client) return;

    try {
      const health = await client.health.check({ timeout: 8_000 });

      // If we were in error / disconnected but the server is back, restore
      if (status !== "connected") {
        useOpenCodeStore.setState({
          status: "connected",
          version: health.version ?? null,
          error: null,
        });

        // Re-fetch project info in the background
        client.projects.current().then((project) => {
          useOpenCodeStore.setState({ currentProject: project });
        }).catch(() => { /* optional */ });
      }
    } catch {
      // Only transition if we were previously connected
      if (status === "connected") {
        useOpenCodeStore.setState({
          status: "error",
          error: "Connection lost — retrying…",
        });
      }
    }
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

interface OpenCodeState {
  url: string;
  status: ConnectionStatus;
  version: string | null;
  error: string | null;
  client: OpenCodeClient | null;
  /** Cached model groups fetched from /config/providers */
  modelGroups: ModelGroup[];
  /** Whether model groups are currently being fetched */
  modelGroupsLoading: boolean;
  /** The currently active project from the connected instance */
  currentProject: Project | null;
  /** Display name of the agent currently connected (e.g. "Claude Code", "OpenCode"). */
  connectedAgent: string | null;
  /** Provider id of the agent currently connected (e.g. "claude-code", "opencode"). */
  connectedAgentId: string | null;
  setUrl: (url: string) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Fetch model groups from the connected instance. No-ops if already cached or not connected. */
  fetchModelGroups: () => Promise<void>;
  /** Fetch the current project from the connected instance. */
  fetchCurrentProject: () => Promise<void>;
}

function loadUrl(): string {
  return loadOpenCodeUrl();
}

function persistUrl(url: string) {
  saveOpenCodeUrl(url);
}

export const useOpenCodeStore = create<OpenCodeState>((set, get) => ({
  url: loadUrl(),
  status: "disconnected",
  version: null,
  error: null,
  client: null,
  modelGroups: [],
  modelGroupsLoading: false,
  currentProject: null,
  connectedAgent: null,
  connectedAgentId: null,

  setUrl: (url) => {
    stopHeartbeat();
    persistUrl(url);
    set({ url, client: null, status: "disconnected", version: null, error: null, modelGroups: [], modelGroupsLoading: false, currentProject: null, connectedAgent: null, connectedAgentId: null });
  },

  connect: async () => {
    const { url } = get();
    set({ status: "connecting", error: null, version: null, client: null, modelGroups: [], modelGroupsLoading: false, currentProject: null, connectedAgent: null, connectedAgentId: null });

    try {
      const client = createOpenCodeClient(url, { timeout: 8_000 });
      const health = await client.health.check();

      set({
        status: "connected",
        version: health.version ?? null,
        error: null,
        client,
      });

      // Start background health-check heartbeat
      startHeartbeat();

      // Fetch current project in the background after connecting
      client.projects.current().then((project) => {
        set({ currentProject: project });
      }).catch(() => {
        // Silently ignore — project info is optional
      });

      // Fetch the connected agent's display name from /config/providers.
      client.config.getProviders().then((res) => {
        const provider = res.providers[0];
        if (provider) {
          set({
            connectedAgent: provider.name,
            connectedAgentId: provider.id,
            modelGroups: buildModelGroups(res.providers),
          });
        }
      }).catch(() => {
        // Optional — fall back to no agent label.
      });
    } catch (err: unknown) {
      const message =
        err instanceof OpenCodeError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      set({ status: "error", error: message, version: null, client: null, connectedAgent: null, connectedAgentId: null });
    }
  },

  disconnect: () => {
    stopHeartbeat();
    set({ status: "disconnected", version: null, error: null, client: null, modelGroups: [], modelGroupsLoading: false, currentProject: null, connectedAgent: null, connectedAgentId: null });
  },

  fetchModelGroups: async () => {
    const { client, status, modelGroups, modelGroupsLoading } = get();
    if (status !== "connected" || !client || modelGroupsLoading) return;
    // Already fetched
    if (modelGroups.length > 0) return;

    set({ modelGroupsLoading: true });
    try {
      const res = await client.config.getProviders();
      set({ modelGroups: buildModelGroups(res.providers), modelGroupsLoading: false });
    } catch {
      set({ modelGroupsLoading: false });
    }
  },

  fetchCurrentProject: async () => {
    const { client, status } = get();
    if (status !== "connected" || !client) return;
    try {
      const project = await client.projects.current();
      set({ currentProject: project });
    } catch {
      // Silently ignore
    }
  },
}));



