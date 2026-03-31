"use client";

import { useState, useCallback, useEffect } from "react";
import { CURRENT_VERSION } from "@/lib/changelog";
import { readStorageValue, writeStorageValue } from "@/lib/browser-storage";

const STORAGE_KEY = "nexus-workflow-studio:last-seen-version";

/**
 * Hook that tracks whether the "What's New" dialog should open.
 * It compares the current app version against the last version the
 * user dismissed. The dialog shows once per new version.
 * Also supports manual opening via the "nexus:open-patch-notes" event.
 */
export function useWhatsNew() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;

    const lastSeenVersion = readStorageValue(STORAGE_KEY);
    return lastSeenVersion !== CURRENT_VERSION;
  });

  // Allow opening from the header Help → Patch Notes menu item
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("nexus:open-patch-notes", handler);
    return () => window.removeEventListener("nexus:open-patch-notes", handler);
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    writeStorageValue(STORAGE_KEY, CURRENT_VERSION);
  }, []);

  return { open, dismiss } as const;
}

