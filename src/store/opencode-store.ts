import { create } from "zustand";
import {
  createOpenCodeClient,
  type OpenCodeClient,
  OpenCodeError,
} from "@/lib/opencode";

const STORAGE_KEY = "nexus:opencode-url";
const DEFAULT_URL = "http://127.0.0.1:4096";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface OpenCodeState {
  url: string;
  status: ConnectionStatus;
  version: string | null;
  error: string | null;
  /** The active API client instance — available after a successful `connect()`. */
  client: OpenCodeClient | null;
  setUrl: (url: string) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
}

function loadUrl(): string {
  if (typeof window === "undefined") return DEFAULT_URL;
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_URL;
}

function persistUrl(url: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, url);
  }
}

export const useOpenCodeStore = create<OpenCodeState>((set, get) => ({
  url: loadUrl(),
  status: "disconnected",
  version: null,
  error: null,
  client: null,

  setUrl: (url) => {
    persistUrl(url);
    set({ url, client: null, status: "disconnected", version: null, error: null });
  },

  connect: async () => {
    const { url } = get();
    set({ status: "connecting", error: null, version: null, client: null });

    try {
      const client = createOpenCodeClient(url, { timeout: 8_000 });
      const health = await client.health.check();

      set({
        status: "connected",
        version: health.version ?? null,
        error: null,
        client,
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
    set({ status: "disconnected", version: null, error: null, client: null });
  },
}));

