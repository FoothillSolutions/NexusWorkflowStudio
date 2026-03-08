"use client";

import { useState, useCallback, useEffect } from "react";
import { CURRENT_VERSION } from "@/lib/changelog";

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
    try {
      return localStorage.getItem(STORAGE_KEY) !== CURRENT_VERSION;
    } catch {
      return false;
    }
  });

  // Allow opening from the header Help → Patch Notes menu item
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("nexus:open-patch-notes", handler);
    return () => window.removeEventListener("nexus:open-patch-notes", handler);
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    } catch {
      // ignore
    }
  }, []);

  return { open, dismiss } as const;
}

