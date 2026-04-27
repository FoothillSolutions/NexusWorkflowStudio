import { describe, expect, it } from "bun:test";
import { parallelAgentRegistryEntry } from "../constants";

const prompt = parallelAgentRegistryEntry.aiGenerationPrompt!;

function allPromptText(): string {
  const parts: string[] = [
    prompt.description,
    prompt.dataTemplate,
    prompt.edgeRules ?? "",
    prompt.connectionRules ?? "",
    ...(prompt.generationHints ?? []),
    ...(prompt.examples ?? []),
    ...(prompt.requiredFields?.map((f) => `${f.field}: ${f.description}`) ?? []),
    ...(prompt.optionalFields?.map((f) => `${f.field}: ${f.description}`) ?? []),
  ];
  return parts.join("\n");
}

describe("parallel-agent aiGenerationPrompt", () => {
  it("mentions spawnMode discriminator", () => {
    expect(allPromptText()).toContain("spawnMode");
  });

  it("documents both fixed and dynamic modes", () => {
    const text = allPromptText();
    expect(text).toContain('"fixed"');
    expect(text).toContain('"dynamic"');
  });

  it("includes the branch-instruction vs agent.promptText clarification", () => {
    const text = allPromptText();
    expect(text).toContain("DO NOT copy the branch instruction into the agent's promptText");
    expect(text).toContain("branch instructions live on the branch object");
  });

  it("shows the fixed-mode branch-0 edge example", () => {
    expect(prompt.edgeRules ?? "").toContain("branch-0");
  });

  it("contains the verbatim single-connector anchor phrase", () => {
    const text = allPromptText();
    expect(text).toContain("In dynamic spawn mode the parallel-agent node has EXACTLY ONE outgoing edge to ONE template Agent node — never emit branch-N handles in dynamic mode.");
  });

  it("does not reference the obsolete top-level dynamic-mode spawnCount field", () => {
    const text = allPromptText();
    expect(text).not.toContain('"spawnCount":null');
    expect(text).not.toContain('"spawnCount":3');
    expect(text).not.toContain('"spawnCount":4');
  });

  it("includes the new spawnMin and spawnMax fields", () => {
    const text = allPromptText();
    expect(text).toContain("spawnMin");
    expect(text).toContain("spawnMax");
  });
});
