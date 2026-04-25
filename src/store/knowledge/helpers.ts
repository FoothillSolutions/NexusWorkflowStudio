import type { KnowledgeDoc, KnowledgeDocType, KnowledgeDocStatus } from "@/types/knowledge";

export function filterDocs(
  docs: KnowledgeDoc[],
  searchQuery: string,
  activeDocType: KnowledgeDocType | "all",
  activeStatus: KnowledgeDocStatus | "all",
): KnowledgeDoc[] {
  let result = docs;

  if (activeDocType !== "all") {
    result = result.filter((d) => d.docType === activeDocType);
  }

  if (activeStatus !== "all") {
    result = result.filter((d) => d.status === activeStatus);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q)) ||
        d.content.toLowerCase().includes(q),
    );
  }

  return result;
}

export function computeSuccessRate(docs: KnowledgeDoc[]): number {
  let success = 0;
  let total = 0;
  for (const doc of docs) {
    for (const fb of doc.metrics.feedback) {
      if (fb.rating === "success") success++;
      total++;
    }
  }
  return total === 0 ? 0 : Math.round((success / total) * 100);
}

export function ratingEmoji(rating: "success" | "failure" | "neutral"): string {
  if (rating === "success") return "✓";
  if (rating === "failure") return "✗";
  return "–";
}
