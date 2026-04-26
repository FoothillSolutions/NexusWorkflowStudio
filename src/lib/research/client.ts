import type { ResearchPromoteInput, ResearchSpaceData, ResearchSpaceRecord, ResearchTemplateId } from "./types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function listResearchSpacesClient(workspaceId: string): Promise<ResearchSpaceRecord[]> {
  const data = await parseJson<{ spaces: ResearchSpaceRecord[] }>(await fetch(`/api/workspaces/${workspaceId}/research-spaces`));
  return data.spaces;
}

export async function createResearchSpaceClient(workspaceId: string, input: { name: string; templateId?: ResearchTemplateId | null }): Promise<ResearchSpaceData> {
  const data = await parseJson<{ space: ResearchSpaceData }>(await fetch(`/api/workspaces/${workspaceId}/research-spaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
  return data.space;
}

export async function getResearchSpaceClient(workspaceId: string, spaceId: string): Promise<ResearchSpaceData> {
  return parseJson<ResearchSpaceData>(await fetch(`/api/workspaces/${workspaceId}/research-spaces/${spaceId}`));
}

export async function saveResearchSpaceClient(workspaceId: string, space: ResearchSpaceData, lastModifiedBy = "browser"): Promise<ResearchSpaceData> {
  const data = await parseJson<{ space: ResearchSpaceData }>(await fetch(`/api/workspaces/${workspaceId}/research-spaces/${space.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: space, lastModifiedBy }),
  }));
  return data.space;
}

export async function deleteResearchSpaceClient(workspaceId: string, spaceId: string): Promise<void> {
  const res = await fetch(`/api/workspaces/${workspaceId}/research-spaces/${spaceId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete research space");
}

export async function promoteResearchClient(workspaceId: string, spaceId: string, input: ResearchPromoteInput) {
  return parseJson<{ doc: unknown; target: string }>(await fetch(`/api/workspaces/${workspaceId}/research-spaces/${spaceId}/promote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
}
