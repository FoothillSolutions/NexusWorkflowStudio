import { describe, expect, it } from "bun:test";
import {
  extractStreamedWorkflow,
  tryParseCompleteJSON,
} from "../../workflow-gen/streaming-parser";

describe("streaming-parser", () => {
  it("extracts the top-level workflow name and complete nodes/edges from partial JSON", () => {
    const partial = `{
      "name": "Review Workflow",
      "nodes": [
        {"id":"start-1","type":"start","position":{"x":0,"y":0},"data":{"type":"start","label":"Start","name":"start-1"}},
        {"id":"prompt-1","type":"prompt","position":{"x":100,"y":0},"data":{"type":"prompt","label":"Prompt","name":"nested-name-should-not-win","promptText":"Hello"}}
      ],
      "edges": [
        {"id":"e1","source":"start-1","target":"prompt-1"}
      ]`;

    const result = extractStreamedWorkflow(partial);
    expect(result.name).toBe("Review Workflow");
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.nodes[1].id).toBe("prompt-1");
  });

  it("returns null for incomplete JSON and parsed data for complete JSON", () => {
    expect(tryParseCompleteJSON('{"name":"partial"')).toBeNull();
    expect(tryParseCompleteJSON('{"name":"complete","nodes":[],"edges":[]}')).toEqual({
      name: "complete",
      nodes: [],
      edges: [],
    });
  });
});

