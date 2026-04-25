import { create } from "zustand";
import {
  createOpenCodeClient,
  type OpenCodeClient,
  OpenCodeError,
} from "@/lib/opencode";
import { loadOpenCodeUrl, saveOpenCodeUrl } from "@/lib/opencode/config";
import type { Project } from "@/lib/opencode/types";
import { buildModelGroups, type ModelGroup } from "./models";
import { notifyConnectorChange } from "./connector-bus";

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
  /**
   * Atomic "switch connector" action. Persists the new URL, tears down any
   * existing client + downstream sessions (via the connector-change bus),
   * then opens a fresh connection. Use this from the connect dialog.
   */
  switchUrl: (url: string) => Promise<void>;
  /**
   * Re-fetch providers (force) + current project against the existing
   * client and notify downstream stores so they dispose stale sessions.
   * Use after a project switch (`projectScopeOnly: true`) or to manually
   * refresh everything.
   */
  reload: (opts?: { projectScopeOnly?: boolean }) => Promise<void>;
  /**
   * Fetch model groups from the connected instance.
   * @param opts.force - bypass the cached `modelGroups.length > 0` guard.
   */
  fetchModelGroups: (opts?: { force?: boolean }) => Promise<void>;
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
    // Notify BEFORE clearing client so downstream listeners can dispose
    // sessions against the still-live client snapshot.
    if (get().client) {
      notifyConnectorChange("url");
    }
    persistUrl(url);
    set({ url, client: null, status: "disconnected", version: null, error: null, modelGroups: [], modelGroupsLoading: false, currentProject: null, connectedAgent: null, connectedAgentId: null });
  },

  connect: async () => {
    const { url, client: prevClient } = get();
    // If we already had a client (reconnect / re-attempt), let downstream
    // stores dispose any sessions tied to it before we replace it.
    if (prevClient) {
      notifyConnectorChange("connect");
    }
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
    if (get().client) {
      notifyConnectorChange("disconnect");
    }
    set({ status: "disconnected", version: null, error: null, client: null, modelGroups: [], modelGroupsLoading: false, currentProject: null, connectedAgent: null, connectedAgentId: null });
  },

  switchUrl: async (url) => {
    // setUrl already notifies + clears state; connect() then opens a fresh
    // session against the new endpoint. Models are fetched by connect().
    get().setUrl(url);
    await get().connect();
  },

  reload: async (opts) => {
    const { client, status } = get();
    if (status !== "connected" || !client) return;
    // Notify downstream so prompt-gen / workflow-gen sessions are disposed
    // against the current (project-scoped) client BEFORE the next request fires.
    notifyConnectorChange(opts?.projectScopeOnly ? "project" : "reload");
    await Promise.all([
      get().fetchModelGroups({ force: true }),
      get().fetchCurrentProject(),
    ]);
  },

  fetchModelGroups: async (opts) => {
    const { client, status, modelGroups, modelGroupsLoading } = get();
    if (status !== "connected" || !client || modelGroupsLoading) return;
    // Already fetched — skip unless caller forces a refresh
    if (!opts?.force && modelGroups.length > 0) return;

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

