export interface WorkspaceRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRecord {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string;
}

export interface WorkspaceManifest {
  version: 1;
  workspace: WorkspaceRecord;
  workflows: WorkflowRecord[];
}
