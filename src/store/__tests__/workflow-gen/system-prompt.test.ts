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

describe("buildSystemPrompt parallel-agent clarifications", () => {
  it("explains branch instructions stay on the branch (anchor phrase present)", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("branch instructions live on the branch object");
    expect(prompt).toContain("DO NOT copy the branch instruction into the agent's promptText");
  });

  it("covers both spawn modes", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('"fixed"');
    expect(prompt).toContain('"dynamic"');
  });

  it("mentions the single output handle for dynamic mode", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('"output"');
  });

  it("includes fixed mode in the CRITICAL handle-connection block", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("In fixed mode");
  });

  it("contains the verbatim single-connector anchor phrase", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("In dynamic spawn mode the parallel-agent node has EXACTLY ONE outgoing edge to ONE template Agent node — never emit branch-N handles in dynamic mode.");
  });

  it("mentions the new spawnMin and spawnMax fields", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("spawnMin");
    expect(prompt).toContain("spawnMax");
  });

  it("no longer references the obsolete dynamic-mode spawnCount template", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain('"spawnCount":null');
  });
});
