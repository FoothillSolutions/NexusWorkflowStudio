import { describe, expect, it } from "bun:test";
import { validatePack, parseFrontmatter } from "@/lib/library-store/validation";
import type { LibraryDocumentRecord, PackRecord, SkillRecord } from "@/lib/library-store/types";

function buildPack(overrides: Partial<PackRecord> = {}): PackRecord {
  return {
    id: "p1",
    libraryId: "lib1",
    packKey: "test",
    name: "Test",
    description: "",
    tags: [],
    basePackId: null,
    external: false,
    currentBranchId: "b1",
    createdBy: "",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    deletedAt: null,
    ...overrides,
  };
}

function buildDoc(id: string, role: LibraryDocumentRecord["role"], path_: string): LibraryDocumentRecord {
  return {
    id,
    packId: "p1",
    role,
    path: path_,
    currentVersionId: `v-${id}`,
    createdBy: "",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    deletedAt: null,
  };
}

function buildSkill(id: string, skillKey: string, entrypointDocId: string): SkillRecord {
  return {
    id,
    packId: "p1",
    skillKey,
    name: skillKey,
    description: "",
    entrypointDocId,
    createdBy: "",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    deletedAt: null,
    deprecated: false,
  };
}

describe("validatePack", () => {
  it("flags missing entrypoint", () => {
    const pack = buildPack();
    const skills = [buildSkill("s1", "x", "missing-doc")];
    const warnings = validatePack({ pack, skills, documents: [], documentContents: new Map() });
    expect(warnings.some((w) => w.code === "missing_entrypoint")).toBe(true);
  });

  it("flags invalid frontmatter", () => {
    const pack = buildPack();
    const doc = buildDoc("d1", "skill-entrypoint", "SKILL.md");
    const skills = [buildSkill("s1", "x", "d1")];
    const contents = new Map([["d1", "no frontmatter here"]]);
    const warnings = validatePack({ pack, skills, documents: [doc], documentContents: contents });
    expect(warnings.some((w) => w.code === "invalid_frontmatter")).toBe(true);
  });

  it("flags duplicate skill keys", () => {
    const pack = buildPack();
    const doc = buildDoc("d1", "skill-entrypoint", "SKILL.md");
    const skills = [buildSkill("s1", "dup", "d1"), buildSkill("s2", "dup", "d1")];
    const contents = new Map([["d1", "---\nname: dup\ndescription: y\n---\n"]]);
    const warnings = validatePack({ pack, skills, documents: [doc], documentContents: contents });
    expect(warnings.some((w) => w.code === "duplicate_skill_id")).toBe(true);
  });

  it("flags broken relative references", () => {
    const pack = buildPack();
    const doc = buildDoc("d1", "doc", "a.md");
    const contents = new Map([["d1", "see [other](./missing.md)"]]);
    const warnings = validatePack({ pack, skills: [], documents: [doc], documentContents: contents });
    expect(warnings.some((w) => w.code === "broken_reference")).toBe(true);
  });

  it("flags unresolved merge", () => {
    const pack = buildPack();
    const warnings = validatePack({ pack, skills: [], documents: [], documentContents: new Map(), unresolvedMergeIds: ["m1"] });
    expect(warnings.some((w) => w.code === "unresolved_merge")).toBe(true);
  });
});

describe("parseFrontmatter", () => {
  it("extracts data and body", () => {
    const result = parseFrontmatter("---\nname: foo\ndescription: bar\n---\nbody text\n");
    expect(result.data).toEqual({ name: "foo", description: "bar" });
    expect(result.body).toContain("body text");
  });

  it("returns null data when no frontmatter", () => {
    const result = parseFrontmatter("just body");
    expect(result.data).toBeNull();
  });
});
