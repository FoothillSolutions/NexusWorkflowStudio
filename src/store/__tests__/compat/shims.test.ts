import { describe, expect, it } from "bun:test";
import {
  buildGenerateUserMessage as buildGenerateUserMessageCanonical,
  runPromptGenRequest as runPromptGenRequestCanonical,
  usePromptGenStore as usePromptGenStoreCanonical,
} from "../../prompt-gen";
import { useSavedWorkflowsStore as useSavedWorkflowsStoreCanonical } from "../../library";
import {
  buildModelGroups as buildModelGroupsCanonical,
  useOpenCodeStore as useOpenCodeStoreCanonical,
} from "../../opencode";
import { usePromptGenStore as usePromptGenStoreLegacy } from "../../prompt-gen-store";
import { buildGenerateUserMessage as buildGenerateUserMessageLegacy } from "../../prompt-gen-helpers";
import { runPromptGenRequest as runPromptGenRequestLegacy } from "../../prompt-gen-runner";
import {
  buildWorkflowJson as buildWorkflowJsonCanonical,
  resolveParentNodes as resolveParentNodesCanonical,
  useWorkflowStore as useWorkflowStoreCanonical,
} from "../../workflow";
import { useWorkflowGenStore as useWorkflowGenStoreCanonical } from "../../workflow-gen";
import { useSavedWorkflowsStore as useSavedWorkflowsStoreLegacy } from "../../library-store";
import {
  buildModelGroups as buildModelGroupsLegacy,
  useOpenCodeStore as useOpenCodeStoreLegacy,
} from "../../opencode-store";
import { useWorkflowStore as useWorkflowStoreLegacy } from "../../workflow-store";
import { buildWorkflowJson as buildWorkflowJsonLegacy } from "../../workflow-store-helpers";
import { resolveParentNodes as resolveParentNodesLegacy } from "../../workflow-store-subworkflow";
import { useWorkflowGenStore as useWorkflowGenStoreLegacy } from "../../workflow-gen-store";

describe("store compatibility shims", () => {
  it("keeps prompt-gen legacy root exports aligned with canonical domain exports", () => {
    expect(usePromptGenStoreLegacy).toBe(usePromptGenStoreCanonical);
    expect(buildGenerateUserMessageLegacy).toBe(buildGenerateUserMessageCanonical);
    expect(runPromptGenRequestLegacy).toBe(runPromptGenRequestCanonical);
  });

  it("keeps workflow legacy root exports aligned with canonical domain exports", () => {
    expect(useWorkflowStoreLegacy).toBe(useWorkflowStoreCanonical);
    expect(resolveParentNodesLegacy).toBe(resolveParentNodesCanonical);
    expect(buildWorkflowJsonLegacy).toBe(buildWorkflowJsonCanonical);
  });

  it("keeps newer store shims aligned with canonical domain exports", () => {
    expect(useSavedWorkflowsStoreLegacy).toBe(useSavedWorkflowsStoreCanonical);
    expect(useOpenCodeStoreLegacy).toBe(useOpenCodeStoreCanonical);
    expect(buildModelGroupsLegacy).toBe(buildModelGroupsCanonical);
    expect(useWorkflowGenStoreLegacy).toBe(useWorkflowGenStoreCanonical);
  });
});

