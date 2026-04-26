import type { SaveBrainDocInput } from "@/lib/brain/types";
import type { ResearchPromoteInput, ResearchSpaceData } from "./types";
import { exportResearchMarkdown } from "./markdown-export";

function selectedSpace(space: ResearchSpaceData, input: ResearchPromoteInput): ResearchSpaceData {
  const blockIds = new Set(input.blockIds ?? []);
  const synthesisIds = new Set(input.synthesisIds ?? []);
  const useAllBlocks = blockIds.size === 0 && synthesisIds.size === 0;
  return {
    ...space,
    blocks: useAllBlocks ? space.blocks : space.blocks.filter((block) => blockIds.has(block.id)),
    syntheses: useAllBlocks ? space.syntheses : space.syntheses.filter((item) => synthesisIds.has(item.id)),
  };
}

export function buildResearchPromotionDoc(
  space: ResearchSpaceData,
  input: ResearchPromoteInput = {},
): SaveBrainDocInput {
  const subset = selectedSpace(space, input);
  const target = input.target ?? "workspace";
  return {
    title: `${space.name} Research`,
    summary: `Promoted ${subset.blocks.length} research tiles and ${subset.syntheses.length} syntheses to ${target} Brain.`,
    content: [
      exportResearchMarkdown(subset),
      "",
      "## Promotion metadata",
      `- Template: ${space.templateId ?? "none"}`,
      `- Target: ${target}`,
    ].join("\n"),
    docType: "summary",
    status: "active",
    createdBy: input.createdBy ?? "research",
    tags: ["research", "workspace-research", target],
    associatedWorkflowIds: input.associatedWorkflowIds?.length ? input.associatedWorkflowIds : space.associatedWorkflowIds,
    versionReason: "import",
  };
}
