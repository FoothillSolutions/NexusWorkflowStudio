import { create } from "zustand";

const STORAGE_KEY = "nexus:opencode-url";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface OpenCodeState {
  url: string;
  status: ConnectionStatus;
  version: string | null;
  error: string | null;
  setUrl: (url: string) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
}

function loadUrl(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:4096";
  return localStorage.getItem(STORAGE_KEY) ?? "http://127.0.0.1:4096";
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

  setUrl: (url) => {
    persistUrl(url);
    set({ url });
  },

  connect: async () => {
    const { url } = get();
    set({ status: "connecting", error: null, version: null });

    try {
      // Normalise: strip trailing slash
      const base = url.replace(/\/+$/, "");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${base}/api/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json().catch(() => ({}));
      const version = data.version ?? data.ver ?? null;

      set({ status: "connected", version, error: null });
    } catch (err: unknown) {
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "Connection timed out"
          : err instanceof TypeError
            ? "Could not reach server — check the URL and make sure the server is running"
            : err instanceof Error
              ? err.message
              : "Unknown error";
      set({ status: "error", error: message, version: null });
    }
  },

  disconnect: () => {
    set({ status: "disconnected", version: null, error: null });
  },
}));

