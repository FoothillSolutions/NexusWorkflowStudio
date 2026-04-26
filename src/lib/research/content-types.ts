import type { ResearchContentType } from "./types";

export const RESEARCH_CONTENT_TYPES: Array<{ id: ResearchContentType; label: string }> = [
  { id: "claim", label: "Claim" },
  { id: "quote", label: "Quote" },
  { id: "source", label: "Source" },
  { id: "task", label: "Task" },
  { id: "question", label: "Question" },
  { id: "decision", label: "Decision" },
  { id: "note", label: "Note" },
];
