import { z } from "zod/v4";

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
});

export const SaveWorkflowSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  lastModifiedBy: z.string().min(1),
});

export const UpdateWorkflowMetaSchema = z.object({
  name: z.string().min(1).max(200),
});
