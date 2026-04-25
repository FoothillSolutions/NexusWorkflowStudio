import { describe, expect, it } from "bun:test";
import { generator } from "@/nodes/skill/generator";
import type { SkillNodeData } from "@/nodes/skill/types";
import { WorkflowNodeType } from "@/types/workflow";
import type { SkillBundle } from "@/types/library";

function buildData(overrides: Partial<SkillNodeData> = {}): SkillNodeData {
  return {
    type: WorkflowNodeType.Skill,
    label: "Skill",
    name: "n1",
    skillName: "test-skill",
    description: "desc",
    promptText: "inline body",
    detectedVariables: [],
    variableMappings: {},
    metadata: [],
    libraryRef: null,
    ...overrides,
  };
}

describe("skill generator", () => {
  it("emits inline content when no libraryRef", () => {
    const data = buildData();
    const file = generator.getSkillFile?.("n1", data);
    expect(file).not.toBeNull();
    expect(file?.path).toContain("/skills/test-skill/SKILL.md");
    expect(file?.content).toContain("inline body");
    expect(file?.content).toContain("name: test-skill");
  });

  it("uses resolved bundle content when libraryRef is set", () => {
    const data = buildData({
      libraryRef: {
        scope: "workspace",
        packId: "p1",
        packKey: "support",
        packVersion: "1.0.0",
        skillId: "s1",
        skillKey: "triage",
      },
    });
    const bundle: SkillBundle = {
      scope: "workspace",
      packId: "p1",
      packKey: "support",
      packVersion: "1.0.0",
      skillId: "s1",
      skillKey: "triage",
      skillName: "Triage",
      description: "Triage skill",
      entrypoint: { docId: "d1", path: "SKILL.md", role: "skill-entrypoint", content: "---\nname: triage\n---\nfrom-pack-content", contentHash: "" },
      documents: [],
      manifestHash: "",
    };
    const file = generator.getSkillFile?.("n1", data, { resolvedBundle: bundle });
    expect(file?.content).toContain("from-pack-content");
    expect(file?.path).toContain("/skills/triage/SKILL.md");
  });

  it("falls back to inline when libraryRef present but no bundle resolved", () => {
    const data = buildData({
      libraryRef: { scope: "workspace", packId: "p1", packVersion: "draft", skillId: "s1" },
    });
    const file = generator.getSkillFile?.("n1", data);
    expect(file?.content).toContain("inline body");
  });

  it("getDetailsSection mentions library reference when present", () => {
    const data = buildData({
      libraryRef: { scope: "workspace", packId: "p1", packKey: "support", packVersion: "1.0.0", skillId: "s1", skillKey: "triage" },
    });
    const section = generator.getDetailsSection?.("n1", data);
    expect(section).toContain("Library Reference");
    expect(section).toContain("support");
  });
});
