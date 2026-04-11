/**
 * SpacetimeDB connection configuration.
 *
 * All values are derived from public environment variables so they are
 * available in both server and client bundles.
 */

const DEFAULT_SPACETIME_URI = "ws://localhost:3001";
const DEFAULT_SPACETIME_DB_NAME = "nexus";

/** WebSocket URI for the SpacetimeDB instance. */
export function getSpacetimeUri(): string {
  const configured = process.env.NEXT_PUBLIC_SPACETIME_URI?.trim();
  if (configured) return configured;

  if (typeof window === "undefined") {
    return DEFAULT_SPACETIME_URI;
  }

  // Derive from current host when no env var is set
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:3001`;
}

/** SpacetimeDB database/module name. */
export function getSpacetimeDbName(): string {
  return process.env.NEXT_PUBLIC_SPACETIME_DB_NAME?.trim() || DEFAULT_SPACETIME_DB_NAME;
}

/** Returns true when SpacetimeDB env vars are configured (non-default). */
export function isSpacetimeConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SPACETIME_URI?.trim());
}
