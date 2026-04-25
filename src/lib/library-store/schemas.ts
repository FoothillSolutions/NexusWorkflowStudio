import { z } from "zod/v4";

export const libraryScopeSchema = z.enum(["workspace", "user"]);

export const documentRoleSchema = z.enum([
  "skill-entrypoint",
  "reference",
  "doc",
  "rule",
  "template",
  "example",
  "asset",
  "script",
  "manifest",
]);

const semverRegex = /^\d+\.\d+\.\d+(-[A-Za-z0-9.\-]+)?(\+[A-Za-z0-9.\-]+)?$/;
export const semverSchema = z.string().regex(semverRegex, "Must be valid semver");

export const skillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  compatibility: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const manifestSkillSchema = z.object({
  skillId: z.string().min(1),
  skillKey: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  entrypoint: z.string().min(1),
  documents: z.array(z.string()).default([]),
  rules: z.array(z.string()).default([]),
});

export const manifestSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  packId: z.string().min(1),
  packKey: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  version: z.string(),
  scope: libraryScopeSchema,
  skills: z.record(z.string(), manifestSkillSchema),
  docs: z.array(z.string()).default([]),
  rules: z.array(z.string()).default([]),
  assets: z.array(z.string()).default([]),
  templates: z.array(z.string()).default([]),
  examples: z.array(z.string()).default([]),
  external: z.boolean().default(false),
  basePackId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ManifestSchemaV1 = z.infer<typeof manifestSchemaV1>;

export const createPackSchema = z.object({
  scope: libraryScopeSchema,
  packKey: z.string().min(1).regex(/^[a-z0-9][a-z0-9\-]*$/, "Lowercase kebab-case"),
  name: z.string().min(1),
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
  createdBy: z.string().default(""),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updatePackSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  scope: libraryScopeSchema.optional(),
});

export const forkPackSchema = z.object({
  targetScope: libraryScopeSchema.default("user"),
  packKey: z.string().min(1).regex(/^[a-z0-9][a-z0-9\-]*$/).optional(),
});

export const createDocumentSchema = z.object({
  role: documentRoleSchema,
  path: z.string().min(1),
  content: z.string().default(""),
  createdBy: z.string().default(""),
  message: z.string().default("create"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateDocumentSchema = z.object({
  role: documentRoleSchema.optional(),
  path: z.string().min(1).optional(),
});

export const saveDocumentVersionSchema = z.object({
  content: z.string(),
  previousVersionId: z.string().nullable(),
  message: z.string().default(""),
  createdBy: z.string().default(""),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createSkillSchema = z.object({
  skillKey: z.string().min(1).regex(/^[a-z0-9][a-z0-9\-]*$/),
  name: z.string().min(1),
  description: z.string().default(""),
  entrypointDocId: z.string().min(1),
  createdBy: z.string().default(""),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateSkillSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  entrypointDocId: z.string().min(1).optional(),
  deprecated: z.boolean().optional(),
});

export const publishPackSchema = z.object({
  version: semverSchema,
  notes: z.string().default(""),
  createdBy: z.string().default(""),
});

export const publishSkillSchema = z.object({
  version: semverSchema,
  notes: z.string().default(""),
  createdBy: z.string().default(""),
  linkToLatestPackVersion: z.boolean().default(false),
});

export const mergeBaseSchema = z.object({
  initiatedBy: z.string().default(""),
});

export const resolveConflictSchema = z.object({
  resolvedContentByDocId: z.record(z.string(), z.string()),
  resolvedBy: z.string().default(""),
});

export const resolveLiveSchema = z.object({
  scope: libraryScopeSchema,
  packId: z.string().min(1),
  packVersion: z.union([semverSchema, z.literal("draft")]),
  skillId: z.string().min(1),
});

export const exportRequestSchema = z.object({
  workflowJson: z.unknown(),
  workflowName: z.string().default("workflow"),
  createdBy: z.string().default(""),
});

export const importRequestSchema = z.object({
  format: z.enum(["nexus", "agent-skills"]).default("nexus"),
  scope: libraryScopeSchema.default("workspace"),
});

export const sessionRequestSchema = z.object({
  token: z.string().min(1).nullable().optional(),
  ownerUserId: z.string().nullable().optional(),
});
