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

// Snapshot types
export interface SnapshotMeta {
  timestamp: string;
  savedBy: string;
}

export interface SnapshotFile {
  timestamp: string;
  workflowId: string;
  workspaceId: string;
  savedBy: string;
  data: import("@/types/workflow").WorkflowJSON;
}

// Change event types
export type ChangeEventType = "node_added" | "node_deleted" | "node_renamed";

export interface ChangeEvent {
  type: ChangeEventType;
  nodeName: string;
  from?: string;
  to?: string;
  by: string;
  at: string;
}

export interface WorkflowChanges {
  workflowId: string;
  workflowName: string;
  changeCount: number;
  events: ChangeEvent[];
}

export interface ChangesResponse {
  changes: WorkflowChanges[];
}
