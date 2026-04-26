import { z } from "zod/v4";

export const ResearchTemplateIdSchema = z.enum([
  "research-brief",
  "prd",
  "implementation-plan",
  "decision-log",
]);

export const ResearchViewModeSchema = z.enum(["tiling", "kanban", "graph"]);
export const ResearchContentTypeSchema = z.enum([
  "claim",
  "quote",
  "source",
  "task",
  "question",
  "decision",
  "note",
]);

export const ResearchSourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().default("Source"),
  url: z.string().optional(),
  excerpt: z.string().optional(),
});

export const ResearchTaskSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  done: z.boolean().default(false),
});

export const ResearchEnrichmentResultSchema = z.object({
  contentType: ResearchContentTypeSchema,
  category: z.string().default("General"),
  annotation: z.string().default(""),
  confidence: z.number().min(0).max(1).catch(0),
  influencedByIndices: z.array(z.number().int().min(0)).default([]),
  influencedByBlockIds: z.array(z.string()).optional(),
  isUnrelated: z.boolean().default(false),
  mergeWithIndex: z.number().int().min(0).nullable().default(null),
  mergeWithBlockId: z.string().nullable().optional(),
  sources: z.array(ResearchSourceSchema).optional(),
});

export const ResearchBlockSchema = z.object({
  id: z.string().min(1),
  content: z.string().default(""),
  contentType: ResearchContentTypeSchema.default("note"),
  category: z.string().default("General"),
  annotation: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0),
  influencedByBlockIds: z.array(z.string()).default([]),
  isUnrelated: z.boolean().default(false),
  mergeWithBlockId: z.string().nullable().default(null),
  sources: z.array(ResearchSourceSchema).default([]),
  tasks: z.array(ResearchTaskSchema).default([]),
  pinned: z.boolean().default(false),
  collapsed: z.boolean().default(false),
  aiError: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().default(""),
  lastModifiedBy: z.string().default(""),
});

export const ResearchSynthesisSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string().default(""),
  sourceBlockIds: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  createdBy: z.string().default(""),
});

export const ResearchGhostNoteSchema = z.object({
  id: z.string().min(1),
  text: z.string().default(""),
  suggestedBlockIds: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
});

export const ResearchSpaceDataSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(200),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().default(""),
  lastModifiedBy: z.string().default(""),
  blocks: z.array(ResearchBlockSchema).default([]),
  collapsedIds: z.array(z.string()).default([]),
  ghostNotes: z.array(ResearchGhostNoteSchema).default([]),
  syntheses: z.array(ResearchSynthesisSchema).default([]),
  templateId: ResearchTemplateIdSchema.nullable().default(null),
  associatedWorkflowIds: z.array(z.string()).default([]),
  viewMode: ResearchViewModeSchema.default("tiling"),
  selectedBlockIds: z.array(z.string()).default([]),
});

export const CreateResearchSpaceSchema = z.object({
  name: z.string().min(1).max(200).default("Untitled Research Space"),
  templateId: ResearchTemplateIdSchema.nullable().optional(),
  createdBy: z.string().optional(),
});

export const SaveResearchSpaceSchema = z.object({
  data: ResearchSpaceDataSchema,
  lastModifiedBy: z.string().min(1).default("anonymous"),
});

export const UpdateResearchSpaceMetaSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  templateId: ResearchTemplateIdSchema.nullable().optional(),
  associatedWorkflowIds: z.array(z.string()).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one update is required");

export const PromoteResearchSchema = z.object({
  target: z.enum(["workspace", "personal"]).default("workspace"),
  blockIds: z.array(z.string()).default([]),
  synthesisIds: z.array(z.string()).default([]),
  taskIds: z.array(z.string()).default([]),
  sourceIds: z.array(z.string()).default([]),
  associatedWorkflowIds: z.array(z.string()).default([]),
  createdBy: z.string().default("research"),
});

export const ImportNodepadSchema = z.object({
  raw: z.string().min(1),
  name: z.string().optional(),
});
