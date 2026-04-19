import { describe, expect, it } from "bun:test";
import { WorkflowNodeType } from "@/types/workflow";
import {
  handoffRegistryEntry,
  handoffSchema,
} from "../constants";

describe("handoff defaultData", () => {
  it("returns mode 'file', empty fileName, structured style, default sections, empty prompt and notes", () => {
    const data = handoffRegistryEntry.defaultData() as Record<string, unknown>;
    expect(data.type).toBe(WorkflowNodeType.Handoff);
    expect(data.mode).toBe("file");
    expect(data.fileName).toBe("");
    expect(data.payloadStyle).toBe("structured");
    expect(Array.isArray(data.payloadSections)).toBe(true);
    expect(data.payloadSections).toEqual(["summary", "artifacts", "nextSteps"]);
    expect(data.payloadPrompt).toBe("");
    expect(data.notes).toBe("");
  });
});

describe("handoffSchema", () => {
  it("accepts valid file-mode input with a blank fileName", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-xy",
      label: "Handoff",
      mode: "file",
      fileName: "",
      payloadStyle: "structured",
      payloadSections: ["summary", "artifacts"],
      payloadPrompt: "",
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a named fileName composed of slug characters", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-xy",
      label: "Handoff",
      mode: "file",
      fileName: "research-handoff_1",
      payloadStyle: "structured",
      payloadSections: ["summary"],
      payloadPrompt: "",
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid context-mode input with an empty fileName", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-ab",
      label: "Handoff",
      mode: "context",
      fileName: "",
      payloadStyle: "structured",
      payloadSections: ["summary", "nextSteps"],
      payloadPrompt: "",
      notes: "Keep it short.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fileName containing slashes", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-xy",
      label: "Handoff",
      mode: "file",
      fileName: "./tmp/bad",
      payloadStyle: "structured",
      payloadSections: [],
      payloadPrompt: "",
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a fileName containing dots", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-xy",
      label: "Handoff",
      mode: "file",
      fileName: "handoff.json",
      payloadStyle: "structured",
      payloadSections: [],
      payloadPrompt: "",
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a fileName containing spaces", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-xy",
      label: "Handoff",
      mode: "file",
      fileName: "my handoff",
      payloadStyle: "structured",
      payloadSections: [],
      payloadPrompt: "",
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown mode value", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-xy",
      label: "Handoff",
      mode: "bogus",
      fileName: "",
      payloadStyle: "structured",
      payloadSections: [],
      payloadPrompt: "",
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown payloadStyle value", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-xy",
      label: "Handoff",
      mode: "file",
      fileName: "",
      payloadStyle: "bogus",
      payloadSections: [],
      payloadPrompt: "",
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown payload sections", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-xy",
      label: "Handoff",
      mode: "file",
      fileName: "",
      payloadStyle: "structured",
      payloadSections: ["not-a-section"],
      payloadPrompt: "",
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid names (spaces, special chars)", () => {
    const result = handoffSchema.safeParse({
      name: "hand off!",
      label: "Handoff",
      mode: "file",
      fileName: "",
      payloadStyle: "structured",
      payloadSections: [],
      payloadPrompt: "",
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("defaults fileName, payloadStyle, payloadSections, payloadPrompt and notes when omitted", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-xy",
      label: "Handoff",
      mode: "context",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fileName).toBe("");
      expect(result.data.payloadStyle).toBe("structured");
      expect(result.data.payloadSections).toEqual([]);
      expect(result.data.payloadPrompt).toBe("");
      expect(result.data.notes).toBe("");
    }
  });

  it("accepts freeform style with a non-empty payloadPrompt", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-xy",
      label: "Handoff",
      mode: "file",
      fileName: "",
      payloadStyle: "freeform",
      payloadSections: [],
      payloadPrompt: "Describe what was explored and what's left to investigate.",
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects freeform style when payloadPrompt is empty", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-xy",
      label: "Handoff",
      mode: "file",
      fileName: "",
      payloadStyle: "freeform",
      payloadSections: [],
      payloadPrompt: "",
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects freeform style when payloadPrompt is whitespace only", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-xy",
      label: "Handoff",
      mode: "file",
      fileName: "",
      payloadStyle: "freeform",
      payloadSections: [],
      payloadPrompt: "   ",
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts structured style with an empty payloadPrompt", () => {
    const result = handoffSchema.safeParse({
      name: "handoff-xy",
      label: "Handoff",
      mode: "file",
      fileName: "",
      payloadStyle: "structured",
      payloadSections: ["summary"],
      payloadPrompt: "",
      notes: "",
    });
    expect(result.success).toBe(true);
  });
});
