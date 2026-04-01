"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useOpenCodeStore } from "@/store/opencode";
import { AGENT_TOOLS } from "@/nodes/agent/constants";

export interface UseToolsResult {
  /** Tool names to render in the Disabled Tools grid */
  tools: readonly string[];
  /** Whether tools are currently being fetched from the API */
  isLoading: boolean;
  /** True when using the static fallback list (not connected or model is "inherit") */
  isStatic: boolean;
}

/**
 * Parse a `"provider/model"` value into its two parts.
 * Returns `null` when the value is not a valid compound key.
 */
function parseModelValue(value: string): { provider: string; model: string } | null {
  if (!value || value === "inherit") return null;
  const idx = value.indexOf("/");
  if (idx < 1) return null;
  return { provider: value.slice(0, idx), model: value.slice(idx + 1) };
}

/**
 * Fetch the tool list for a given model value.
 *
 * - When `modelValue` is `"inherit"` or empty, returns the static `AGENT_TOOLS`.
 * - When connected and a concrete model is selected (`provider/model`), fetches
 *   tools from `/experimental/tool?provider=...&model=...` and returns the IDs.
 * - Falls back to `AGENT_TOOLS` on error or when not connected.
 */
export function useTools(modelValue: string): UseToolsResult {
  const status = useOpenCodeStore((s) => s.status);
  const client = useOpenCodeStore((s) => s.client);
  const isConnected = status === "connected";

  // Cache maps a model key ("provider/model") → fetched tool IDs.
  // null means "no dynamic result available, use static fallback".
  const [cache, setCache] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Track the latest request to avoid acting on stale responses.
  const requestIdRef = useRef(0);

  // Determine whether we should fetch dynamically
  const parsed = useMemo(() => parseModelValue(modelValue), [modelValue]);
  const shouldFetch = isConnected && !!client && parsed !== null;

  useEffect(() => {
    if (!shouldFetch || !parsed || !client) return;

    // Already cached for this key – nothing to do
    if (cache[modelValue]) return;

    const requestId = ++requestIdRef.current;
    setIsLoading(true);

    client.tools
      .list({ provider: parsed.provider, model: parsed.model })
      .then((items) => {
        if (requestIdRef.current !== requestId) return;
        // Deduplicate — the API can return the same tool ID more than once.
        // Also filter out the "invalid" sentinel tool.
        const ids = [...new Set(
          items.map((t) => t.id).filter((id) => id !== "invalid"),
        )];
        if (ids.length > 0) {
          setCache((prev) => ({ ...prev, [modelValue]: ids }));
        }
      })
      .catch(() => {
        // fall back to static – nothing to store
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFetch, modelValue, client]);

  const dynamicTools = parsed ? cache[modelValue] ?? null : null;
  const isStatic = dynamicTools === null;
  const tools: readonly string[] = dynamicTools ?? AGENT_TOOLS;

  return { tools, isLoading, isStatic };
}

