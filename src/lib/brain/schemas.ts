import { z } from "zod";

export const knowledgeFeedbackSchema = z.object({
  id: z.string().min(1),
  rating: z.enum(["success", "failure", "neutral"]),
  note: z.string(),
  author: z.string(),
  at: z.string().datetime(),
});

export const knowledgeMetricsSchema = z.object({
  views: z.number().int().min(0),
  lastViewedAt: z.string().datetime().nullable(),
  feedback: z.array(knowledgeFeedbackSchema),
});

export const saveBrainDocInputSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1, "title is required"),
  summary: z.string().default(""),
  content: z.string().default(""),
  docType: z.enum(["note", "summary", "runbook", "guide", "data"]),
  status: z.enum(["draft", "active", "archived"]),
  createdBy: z.string().default(""),
  tags: z.array(z.string()).default([]),
  associatedWorkflowIds: z.array(z.string()).default([]),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  metrics: knowledgeMetricsSchema.optional(),
  versionReason: z.enum(["save", "import", "restore", "delete", "migration"]).optional(),
});

export const knowledgeDocSchema = saveBrainDocInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metrics: knowledgeMetricsSchema,
}).omit({
  versionReason: true,
});

export const brainSessionRequestSchema = z.object({
  token: z.string().min(1).nullable().optional(),
  legacyBrain: z.object({
    version: z.literal("1"),
    exportedAt: z.string().datetime(),
    docs: z.array(knowledgeDocSchema),
  }).nullable().optional(),
});

export const restoreBrainVersionSchema = z.object({
  versionId: z.string().min(1, "versionId is required"),
});

export const addBrainFeedbackSchema = z.object({
  feedback: knowledgeFeedbackSchema,
});
