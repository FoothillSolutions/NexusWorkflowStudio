import { describe, expect, it } from "bun:test";
import { buildSystemPrompt } from "../../workflow-gen/system-prompt";

describe("buildSystemPrompt edit-mode clause", () => {
  it("omits the Edit Mode Rules block when mode is generate", () => {
    const prompt = buildSystemPrompt({ mode: "generate" });
    expect(prompt).not.toContain("## Edit Mode Rules");
    expect(prompt.trim().endsWith("NOW OUTPUT ONLY JSON.")).toBe(true);
  });

  it("omits the Edit Mode Rules block when no mode is supplied", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain("## Edit Mode Rules");
    expect(prompt.trim().endsWith("NOW OUTPUT ONLY JSON.")).toBe(true);
  });

  it("appends the Edit Mode Rules block when mode is edit", () => {
    const prompt = buildSystemPrompt({ mode: "edit" });
    expect(prompt).toContain("## Edit Mode Rules");
    expect(prompt).toContain("Copy unchanged nodes, edges");
    expect(prompt.trim().endsWith("NOW OUTPUT ONLY JSON.")).toBe(true);
  });
});
