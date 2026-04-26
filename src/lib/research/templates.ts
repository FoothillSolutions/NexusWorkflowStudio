import type { ResearchBlock, ResearchTemplateId } from "./types";

const TEMPLATE_NAMES: Record<ResearchTemplateId, string> = {
  "research-brief": "Research Brief",
  prd: "Product Requirements Document",
  "implementation-plan": "Implementation Plan",
  "decision-log": "Decision Log",
};

const SEEDS: Record<ResearchTemplateId, Array<Pick<ResearchBlock, "content" | "contentType" | "category" | "annotation" | "tasks">>> = {
  "research-brief": [
    { content: "Research objective and decision to support", contentType: "question", category: "Objective", annotation: "Define the decision this research should inform.", tasks: [] },
    { content: "Known facts, assumptions, and constraints", contentType: "claim", category: "Context", annotation: "Capture validated context separately from assumptions.", tasks: [] },
    { content: "Open questions and evidence gaps", contentType: "question", category: "Questions", annotation: "Track unresolved points for follow-up.", tasks: [{ id: "task-follow-up", text: "Assign owners for the top evidence gaps", done: false }] },
  ],
  prd: [
    { content: "Problem statement and target users", contentType: "claim", category: "Problem", annotation: "Summarize user pain and impacted personas.", tasks: [] },
    { content: "Must-have requirements", contentType: "task", category: "Requirements", annotation: "Convert into implementation-ready requirements.", tasks: [{ id: "task-acceptance", text: "Add acceptance criteria for each must-have", done: false }] },
    { content: "Risks, non-goals, and launch considerations", contentType: "note", category: "Scope", annotation: "Keep scope explicit to avoid drift.", tasks: [] },
  ],
  "implementation-plan": [
    { content: "Architecture approach and integration touchpoints", contentType: "claim", category: "Architecture", annotation: "Identify files, APIs, and dependencies to change.", tasks: [] },
    { content: "Step-by-step build sequence", contentType: "task", category: "Execution", annotation: "Order work to keep validation possible after each phase.", tasks: [{ id: "task-tests", text: "Add focused tests before broad validation", done: false }] },
    { content: "Validation and rollback plan", contentType: "note", category: "Validation", annotation: "List commands, expected outputs, and rollback strategy.", tasks: [] },
  ],
  "decision-log": [
    { content: "Decision under consideration", contentType: "decision", category: "Decision", annotation: "State the decision in one sentence.", tasks: [] },
    { content: "Options and trade-offs", contentType: "claim", category: "Options", annotation: "Compare cost, benefit, risk, and reversibility.", tasks: [] },
    { content: "Chosen path, rationale, and follow-ups", contentType: "decision", category: "Outcome", annotation: "Record the final choice and resulting actions.", tasks: [{ id: "task-communicate", text: "Share the decision with stakeholders", done: false }] },
  ],
};

function nowIso(): string {
  return new Date().toISOString();
}

export function getResearchTemplateName(templateId: ResearchTemplateId): string {
  return TEMPLATE_NAMES[templateId];
}

export function createTemplateBlocks(templateId: ResearchTemplateId, createdBy = "template"): ResearchBlock[] {
  const now = nowIso();
  return SEEDS[templateId].map((seed, index) => ({
    id: `${templateId}-block-${index + 1}`,
    content: seed.content,
    contentType: seed.contentType,
    category: seed.category,
    annotation: seed.annotation,
    confidence: 1,
    influencedByBlockIds: index > 0 ? [`${templateId}-block-${index}`] : [],
    isUnrelated: false,
    mergeWithBlockId: null,
    sources: [],
    tasks: seed.tasks,
    pinned: index === 0,
    collapsed: false,
    createdAt: now,
    updatedAt: now,
    createdBy,
    lastModifiedBy: createdBy,
  }));
}

export const RESEARCH_TEMPLATE_IDS = Object.keys(TEMPLATE_NAMES) as ResearchTemplateId[];
