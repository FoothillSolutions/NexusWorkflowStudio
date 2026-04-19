import { describe, expect, it } from "bun:test";
import { WorkflowNodeType } from "@/types/workflow";
import { parallelAgentRegistryEntry, parallelAgentSchema } from "../constants";

describe("parallel-agent defaultData", () => {
  it("returns spawnMode: 'fixed' with 2 branches, empty criterion, spawnMin=1, spawnMax=1", () => {
    const data = parallelAgentRegistryEntry.defaultData() as Record<string, unknown>;
    expect(data.type).toBe(WorkflowNodeType.ParallelAgent);
    expect(data.spawnMode).toBe("fixed");
    expect(Array.isArray(data.branches)).toBe(true);
    expect((data.branches as unknown[]).length).toBe(2);
    expect(data.spawnCriterion).toBe("");
    expect(data.spawnMin).toBe(1);
    expect(data.spawnMax).toBe(1);
    expect(data.spawnCount).toBeUndefined();
  });
});

describe("parallelAgentSchema — fixed mode", () => {
  it("parses valid fixed-mode data", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-a",
      label: "Parallel",
      spawnMode: "fixed",
      sharedInstructions: "",
      branches: [{ label: "Branch 1", instructions: "", spawnCount: 1 }],
      spawnCriterion: "",
      spawnMin: 1,
      spawnMax: 1,
    });
    expect(result.success).toBe(true);
  });

  it("migrates legacy shape (no spawnMode, no spawn fields) by defaulting to fixed with spawnMin/spawnMax=1 and spawnCriterion=''", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-legacy",
      label: "Legacy",
      sharedInstructions: "",
      branches: [{ label: "Branch 1", instructions: "", spawnCount: 1 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.spawnMode).toBe("fixed");
      expect(result.data.spawnCriterion).toBe("");
      expect(result.data.spawnMin).toBe(1);
      expect(result.data.spawnMax).toBe(1);
    }
  });

  it("rejects empty branches in fixed mode", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-a",
      label: "Parallel",
      spawnMode: "fixed",
      sharedInstructions: "",
      branches: [],
      spawnCriterion: "",
      spawnMin: 1,
      spawnMax: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-empty spawnCriterion in fixed mode", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-a",
      label: "Parallel",
      spawnMode: "fixed",
      sharedInstructions: "",
      branches: [{ label: "Branch 1", instructions: "", spawnCount: 1 }],
      spawnCriterion: "per item",
      spawnMin: 1,
      spawnMax: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects spawnMin !== 1 in fixed mode", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-a",
      label: "Parallel",
      spawnMode: "fixed",
      sharedInstructions: "",
      branches: [{ label: "Branch 1", instructions: "", spawnCount: 1 }],
      spawnCriterion: "",
      spawnMin: 2,
      spawnMax: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects spawnMax !== 1 in fixed mode", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-a",
      label: "Parallel",
      spawnMode: "fixed",
      sharedInstructions: "",
      branches: [{ label: "Branch 1", instructions: "", spawnCount: 1 }],
      spawnCriterion: "",
      spawnMin: 1,
      spawnMax: 3,
    });
    expect(result.success).toBe(false);
  });
});

describe("parallelAgentSchema — dynamic mode", () => {
  it("accepts { spawnCriterion: 'per item', spawnMin: 1, spawnMax: 3 }", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-d",
      label: "Parallel",
      spawnMode: "dynamic",
      sharedInstructions: "",
      branches: [],
      spawnCriterion: "per item",
      spawnMin: 1,
      spawnMax: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts spawnMin === spawnMax (exact count)", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-d",
      label: "Parallel",
      spawnMode: "dynamic",
      sharedInstructions: "",
      branches: [],
      spawnCriterion: "one per topic",
      spawnMin: 3,
      spawnMax: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty spawnCriterion", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-d",
      label: "Parallel",
      spawnMode: "dynamic",
      sharedInstructions: "",
      branches: [],
      spawnCriterion: "",
      spawnMin: 1,
      spawnMax: 3,
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only spawnCriterion", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-d",
      label: "Parallel",
      spawnMode: "dynamic",
      sharedInstructions: "",
      branches: [],
      spawnCriterion: "   ",
      spawnMin: 1,
      spawnMax: 3,
    });
    expect(result.success).toBe(false);
  });

  it("rejects spawnMin === 0", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-d",
      label: "Parallel",
      spawnMode: "dynamic",
      sharedInstructions: "",
      branches: [],
      spawnCriterion: "per item",
      spawnMin: 0,
      spawnMax: 3,
    });
    expect(result.success).toBe(false);
  });

  it("rejects spawnMax < spawnMin", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-d",
      label: "Parallel",
      spawnMode: "dynamic",
      sharedInstructions: "",
      branches: [],
      spawnCriterion: "per item",
      spawnMin: 3,
      spawnMax: 2,
    });
    expect(result.success).toBe(false);
  });

  it("round-trips spawnCriterion text through parse without modification (persistence regression guard)", () => {
    const result = parallelAgentSchema.parse({
      name: "parallel-d",
      label: "Parallel",
      spawnMode: "dynamic",
      sharedInstructions: "",
      branches: [],
      spawnCriterion: "hello world",
      spawnMin: 1,
      spawnMax: 1,
    });
    expect(result.spawnCriterion).toBe("hello world");
  });
});

describe("parallelAgentSchema — legacy spawnCount migration", () => {
  it("maps legacy spawnCount: 4 to spawnMin=4, spawnMax=4 and drops spawnCount", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-d",
      label: "Parallel",
      spawnMode: "dynamic",
      sharedInstructions: "",
      branches: [],
      spawnCount: 4,
      spawnCriterion: "per item",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.spawnMin).toBe(4);
      expect(result.data.spawnMax).toBe(4);
      expect((result.data as Record<string, unknown>).spawnCount).toBeUndefined();
    }
  });

  it("does not override explicit spawnMin/spawnMax when spawnCount is also present", () => {
    const result = parallelAgentSchema.safeParse({
      name: "parallel-d",
      label: "Parallel",
      spawnMode: "dynamic",
      sharedInstructions: "",
      branches: [],
      spawnCount: 4,
      spawnMin: 1,
      spawnMax: 6,
      spawnCriterion: "per item",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.spawnMin).toBe(1);
      expect(result.data.spawnMax).toBe(6);
      expect((result.data as Record<string, unknown>).spawnCount).toBeUndefined();
    }
  });
});
