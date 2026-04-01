import { describe, expect, it } from "bun:test";
import { parseSelectedModel } from "../../workflow-gen/model-utils";

describe("workflow-gen model utils", () => {
  it("returns null when no selected model is set", () => {
    expect(parseSelectedModel(null)).toBeNull();
  });

  it("parses provider-prefixed model identifiers", () => {
    expect(parseSelectedModel("anthropic/claude-sonnet-4")).toEqual({
      providerId: "anthropic",
      modelId: "claude-sonnet-4",
    });
  });

  it("treats providerless identifiers as model-only selections", () => {
    expect(parseSelectedModel("local-model")).toEqual({
      providerId: "",
      modelId: "local-model",
    });
  });
});

