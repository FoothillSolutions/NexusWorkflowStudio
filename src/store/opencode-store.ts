import { create } from "zustand";
import {
  createOpenCodeClient,
  type OpenCodeClient,
  OpenCodeError,
} from "@/lib/opencode";
import { loadOpenCodeUrl, saveOpenCodeUrl } from "@/lib/opencode/config";
import type { Provider, Project } from "@/lib/opencode/types";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface DynamicModel {
  value: string;
  displayName: string;
}

export interface ModelGroup {
  label: string;
  providerId: string;
  color: string;
  textColor: string;
  models: DynamicModel[];
}

// ── Provider colour palette ──────────────────────────────────────────────────

const PROVIDER_COLORS: Array<{ color: string; textColor: string }> = [
  { color: "bg-blue-400",    textColor: "text-blue-400/70" },
  { color: "bg-emerald-400", textColor: "text-emerald-400/70" },
  { color: "bg-orange-400",  textColor: "text-orange-400/70" },
  { color: "bg-violet-400",  textColor: "text-violet-400/70" },
  { color: "bg-rose-400",    textColor: "text-rose-400/70" },
  { color: "bg-cyan-400",    textColor: "text-cyan-400/70" },
  { color: "bg-amber-400",   textColor: "text-amber-400/70" },
  { color: "bg-pink-400",    textColor: "text-pink-400/70" },
];

const KNOWN_PROVIDER_COLORS: Record<string, { color: string; textColor: string }> = {
  "github-copilot": { color: "bg-blue-400",    textColor: "text-blue-400/70" },
  opencode:         { color: "bg-emerald-400",  textColor: "text-emerald-400/70" },
  anthropic:        { color: "bg-orange-400",   textColor: "text-orange-400/70" },
  google:           { color: "bg-cyan-400",     textColor: "text-cyan-400/70" },
  openai:           { color: "bg-emerald-400",  textColor: "text-emerald-400/70" },
};

function getProviderColors(id: string, index: number) {
  return KNOWN_PROVIDER_COLORS[id] ?? PROVIDER_COLORS[index % PROVIDER_COLORS.length];
}

// ── Family → vendor sub-group mapping ────────────────────────────────────────
// Maps model family prefixes to a human-readable vendor label + colour.
// Used to sub-group models within multi-vendor providers like GitHub Copilot.

interface VendorInfo { label: string; color: string; textColor: string; order: number }

const FAMILY_VENDOR_MAP: Record<string, VendorInfo> = {
  "claude":  { label: "Anthropic",  color: "bg-orange-400",  textColor: "text-orange-400/70",  order: 0 },
  "gemini":  { label: "Google",     color: "bg-cyan-400",    textColor: "text-cyan-400/70",    order: 1 },
  "gpt":     { label: "OpenAI",     color: "bg-emerald-400", textColor: "text-emerald-400/70", order: 2 },
  "grok":    { label: "xAI",        color: "bg-rose-400",    textColor: "text-rose-400/70",    order: 3 },
};

function resolveVendor(family: string | undefined): VendorInfo | null {
  if (!family) return null;
  // Match the longest prefix first (e.g. "claude-sonnet" matches "claude")
  for (const [prefix, info] of Object.entries(FAMILY_VENDOR_MAP)) {
    if (family.startsWith(prefix)) return info;
  }
  return null;
}

/** Threshold: if a provider has more models than this, sub-group by family vendor */
const SUB_GROUP_THRESHOLD = 6;

function buildModelGroups(providers: Provider[]): ModelGroup[] {
  const result: ModelGroup[] = [];

  for (const [pIdx, provider] of providers.entries()) {
    const activeModels = Object.values(provider.models).filter((m) => m.status === "active");
    if (activeModels.length === 0) continue;

    // Decide whether to sub-group by vendor family
    const hasMultipleVendors = new Set(
      activeModels.map((m) => resolveVendor(m.family)?.label).filter(Boolean),
    ).size > 1;

    if (hasMultipleVendors && activeModels.length > SUB_GROUP_THRESHOLD) {
      // Group models by vendor within this provider
      const vendorBuckets = new Map<string, { info: VendorInfo; models: DynamicModel[] }>();
      const ungrouped: DynamicModel[] = [];

      for (const m of activeModels) {
        const vendor = resolveVendor(m.family);
        const dm: DynamicModel = { value: `${provider.id}/${m.id}`, displayName: m.name };
        if (vendor) {
          const key = vendor.label;
          if (!vendorBuckets.has(key)) vendorBuckets.set(key, { info: vendor, models: [] });
          vendorBuckets.get(key)!.models.push(dm);
        } else {
          ungrouped.push(dm);
        }
      }

      // Sort buckets by predefined order, then alphabetically within each
      const sorted = [...vendorBuckets.values()].sort((a, b) => a.info.order - b.info.order);
      for (const bucket of sorted) {
        bucket.models.sort((a, b) => a.displayName.localeCompare(b.displayName));
        result.push({
          label: `${provider.name} · ${bucket.info.label}`,
          providerId: provider.id,
          color: bucket.info.color,
          textColor: bucket.info.textColor,
          models: bucket.models,
        });
      }

      // Any models that didn't match a known vendor go into a catch-all group
      if (ungrouped.length > 0) {
        ungrouped.sort((a, b) => a.displayName.localeCompare(b.displayName));
        const fallback = getProviderColors(provider.id, pIdx);
        result.push({
          label: `${provider.name} · Other`,
          providerId: provider.id,
          color: fallback.color,
          textColor: fallback.textColor,
          models: ungrouped,
        });
      }
    } else {
      // Small / single-vendor provider → flat group
      const models = activeModels
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => ({ value: `${provider.id}/${m.id}`, displayName: m.name }));
      const colors = getProviderColors(provider.id, pIdx);
      result.push({ label: provider.name, providerId: provider.id, color: colors.color, textColor: colors.textColor, models });
    }
  }

  return result;
}

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

  setUrl: (url) => {
    stopHeartbeat();
    persistUrl(url);
    set({ url, client: null, status: "disconnected", version: null, error: null, modelGroups: [], modelGroupsLoading: false, currentProject: null });
  },

  connect: async () => {
    const { url } = get();
    set({ status: "connecting", error: null, version: null, client: null, modelGroups: [], modelGroupsLoading: false, currentProject: null });

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
    } catch (err: unknown) {
      const message =
        err instanceof OpenCodeError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      set({ status: "error", error: message, version: null, client: null });
    }
  },

  disconnect: () => {
    stopHeartbeat();
    set({ status: "disconnected", version: null, error: null, client: null, modelGroups: [], modelGroupsLoading: false, currentProject: null });
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

