import type { ResearchContentType } from "./types";

export function detectResearchContentType(text: string): ResearchContentType {
  const value = text.trim().toLowerCase();
  if (!value) return "note";
  if (/^[-*]\s*\[[ x]\]/.test(value) || value.startsWith("todo") || value.includes(" action ")) return "task";
  if (value.endsWith("?") || value.startsWith("why ") || value.startsWith("how ")) return "question";
  if (value.includes("http://") || value.includes("https://")) return "source";
  if (value.startsWith(">") || value.includes("“") || value.includes("\"")) return "quote";
  if (value.includes("decide") || value.includes("decision") || value.includes("chosen")) return "decision";
  if (value.includes("because") || value.includes("therefore") || value.includes("we believe")) return "claim";
  return "note";
}
