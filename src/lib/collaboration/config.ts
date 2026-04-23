const DEFAULT_COLLAB_PORT = "1234";
const COLLAB_PATH = "/collab";

/**
 * Resolve the WebSocket URL for the collab server.
 *
 * Resolution order:
 * 1. `NEXT_PUBLIC_COLLAB_SERVER_URL` — explicit override (used by local dev
 *    to point at a separately-running Hocuspocus on port 1234).
 * 2. Same-origin `/collab` path — works in any deployment where the Next.js
 *    server also handles WebSocket upgrades at `/collab` (see `server.ts`).
 *    This is what production hosts (HTTPS behind a reverse proxy) should use
 *    because it needs no per-deploy configuration.
 */
export function getCollabServerUrl(): string {
  const configured = process.env.NEXT_PUBLIC_COLLAB_SERVER_URL?.trim();
  if (configured) return configured;

  if (typeof window === "undefined") {
    return `ws://localhost:${DEFAULT_COLLAB_PORT}${COLLAB_PATH}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${COLLAB_PATH}`;
}

export function buildCollabRoomUrl(roomId: string): string {
  if (typeof window === "undefined") return `?room=${roomId}`;

  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildCollabShareUrl(roomId: string): string {
  if (typeof window === "undefined") return buildCollabRoomUrl(roomId);
  return `${window.location.origin}${buildCollabRoomUrl(roomId)}`;
}

export function buildWorkspaceRoomId(workspaceId: string, workflowId: string): string {
  return `nexus-ws-${workspaceId}-${workflowId}`;
}

export function buildWorkspaceCollabShareUrl(workspaceId: string, workflowId: string): string {
  if (typeof window === "undefined") return `/workspace/${workspaceId}/workflow/${workflowId}`;
  return `${window.location.origin}/workspace/${workspaceId}/workflow/${workflowId}`;
}
