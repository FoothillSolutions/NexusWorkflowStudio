import { readStorageValue, writeStorageValue } from "@/lib/browser-storage";

export const OPENCODE_STORAGE_KEY = "nexus:opencode-url";
export const DEFAULT_OPENCODE_URL = "http://127.0.0.1:4096";

export function loadOpenCodeUrl(): string {
  return readStorageValue(OPENCODE_STORAGE_KEY) ?? DEFAULT_OPENCODE_URL;
}

export function saveOpenCodeUrl(url: string): void {
  writeStorageValue(OPENCODE_STORAGE_KEY, url);
}

