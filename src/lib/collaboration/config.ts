const DEFAULT_COLLAB_PORT = "1234";

export function getCollabServerUrl(): string {
  const configured = process.env.NEXT_PUBLIC_COLLAB_SERVER_URL?.trim();
  if (configured) return configured;

  if (typeof window === "undefined") {
    return `ws://localhost:${DEFAULT_COLLAB_PORT}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:${DEFAULT_COLLAB_PORT}`;
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
