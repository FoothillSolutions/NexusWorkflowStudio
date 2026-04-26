import type { ResearchBlock, ResearchSpaceData } from "./types";

const ORDER = ["claim", "decision", "question", "task", "quote", "source", "note"];

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function blockLine(block: ResearchBlock): string {
  if (block.contentType === "task" || block.tasks.length) {
    const tasks = block.tasks.map((task) => `  - [${task.done ? "x" : " "}] ${task.text}`).join("\n");
    return `- [ ] ${block.content}${tasks ? `\n${tasks}` : ""}`;
  }
  if (block.contentType === "quote") return `> ${block.content}\n>\n> _${block.annotation || block.category}_`;
  return `- ${block.content}${block.annotation ? ` — ${block.annotation}` : ""}`;
}

export function exportResearchMarkdown(space: ResearchSpaceData): string {
  const sections = ORDER.map((type) => {
    const blocks = space.blocks.filter((block) => block.contentType === type);
    if (!blocks.length) return "";
    return [`## ${type[0].toUpperCase()}${type.slice(1)}s`, "", ...blocks.map(blockLine)].join("\n");
  }).filter(Boolean);

  const sources = space.blocks.flatMap((block) => block.sources);
  const sourceTable = sources.length
    ? [
      "## Sources",
      "",
      "| Title | URL | Excerpt |",
      "|---|---|---|",
      ...sources.map((source) => `| ${escapeCell(source.title)} | ${escapeCell(source.url ?? "")} | ${escapeCell(source.excerpt ?? "")} |`),
    ].join("\n")
    : "";

  return [
    "---",
    `title: ${space.name}`,
    `workspaceId: ${space.workspaceId}`,
    `exportedAt: ${new Date().toISOString()}`,
    "---",
    "",
    `# ${space.name}`,
    "",
    sections.join("\n\n") || "_No research notes yet._",
    sourceTable,
    space.syntheses.length ? `## Syntheses\n\n${space.syntheses.map((item) => item.content).join("\n\n")}` : "",
  ].filter(Boolean).join("\n\n");
}
