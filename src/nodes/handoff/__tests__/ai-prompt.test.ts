import { describe, expect, it } from "bun:test";
import { handoffRegistryEntry } from "../constants";

const prompt = handoffRegistryEntry.aiGenerationPrompt!;

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

describe("handoff aiGenerationPrompt", () => {
  it("documents both file and context modes", () => {
    const text = allPromptText();
    expect(text).toContain('"file"');
    expect(text).toContain('"context"');
  });

  it("mentions the fileName field and explains blank means the node id is used", () => {
    const text = allPromptText();
    expect(text).toContain("fileName");
    expect(text).toContain("node id");
    expect(text).toContain("./tmp/handoff-");
  });

  it("documents both structured and freeform payload styles", () => {
    const text = allPromptText();
    expect(text).toContain("payloadStyle");
    expect(text).toContain('"structured"');
    expect(text).toContain('"freeform"');
    expect(text).toContain("payloadPrompt");
  });

  it("lists the payload-section names", () => {
    const text = allPromptText();
    expect(text).toContain("summary");
    expect(text).toContain("artifacts");
    expect(text).toContain("nextSteps");
    expect(text).toContain("blockers");
    expect(text).toContain("openQuestions");
    expect(text).toContain("filePaths");
    expect(text).toContain("state");
    expect(text).toContain("notes");
  });

  it("states that a handoff should sit between two agent nodes", () => {
    const text = allPromptText();
    expect(text).toContain("between two agent");
  });

  it("describes the context-mode runtime contract", () => {
    const text = (prompt.connectionRules ?? "") + "\n" + (prompt.generationHints ?? []).join("\n");
    expect(text).toContain("Handoff Payload");
    expect(text).toContain("inline");
  });

  it("includes at least one example per payload style", () => {
    const examples = prompt.examples ?? [];
    expect(examples.length).toBeGreaterThanOrEqual(2);
    const joined = examples.join("\n");
    expect(joined).toContain('"structured"');
    expect(joined).toContain('"freeform"');
  });
});
