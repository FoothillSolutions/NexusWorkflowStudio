import { describe, expect, it } from "bun:test";
import {
  buildGenerateUserMessage as buildGenerateUserMessageCanonical,
  runPromptGenRequest as runPromptGenRequestCanonical,
  usePromptGenStore as usePromptGenStoreCanonical,
} from "../../prompt-gen";
import { usePromptGenStore as usePromptGenStoreLegacy } from "../../prompt-gen-store";
import { buildGenerateUserMessage as buildGenerateUserMessageLegacy } from "../../prompt-gen-helpers";
import { runPromptGenRequest as runPromptGenRequestLegacy } from "../../prompt-gen-runner";
import {
  resolveParentNodes as resolveParentNodesCanonical,
  useWorkflowStore as useWorkflowStoreCanonical,
} from "../../workflow";
import { useWorkflowStore as useWorkflowStoreLegacy } from "../../workflow-store";
import { resolveParentNodes as resolveParentNodesLegacy } from "../../workflow-store-subworkflow";

describe("store compatibility shims", () => {
  it("keeps prompt-gen legacy root exports aligned with canonical domain exports", () => {
    expect(usePromptGenStoreLegacy).toBe(usePromptGenStoreCanonical);
    expect(buildGenerateUserMessageLegacy).toBe(buildGenerateUserMessageCanonical);
    expect(runPromptGenRequestLegacy).toBe(runPromptGenRequestCanonical);
  });

  it("keeps workflow legacy root exports aligned with canonical domain exports", () => {
    expect(useWorkflowStoreLegacy).toBe(useWorkflowStoreCanonical);
    expect(resolveParentNodesLegacy).toBe(resolveParentNodesCanonical);
  });
});

