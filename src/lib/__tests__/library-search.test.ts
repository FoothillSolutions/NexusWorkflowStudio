import { describe, expect, it } from "bun:test";
import {
  collectSearchableStrings,
  getLibrarySearchScore,
  normalizeLibrarySearchText,
  rankLibrarySearchResults,
} from "../library-search";

describe("library search", () => {
  it("normalizes accents, punctuation, and case-shaped identifiers", () => {
    expect(normalizeLibrarySearchText("CaféWorkflow_HTTP-parser")).toBe("cafe workflow http parser");
  });

  it("matches search terms across separate fields", () => {
    expect(getLibrarySearchScore("refund agent", ["Customer Support", "Agent for refunds"])).not.toBeNull();
    expect(getLibrarySearchScore("refund compiler", ["Customer Support", "Agent for refunds"])).toBeNull();
  });

  it("matches acronyms and subsequence patterns", () => {
    expect(getLibrarySearchScore("rw", ["Reusable Workflow"])).not.toBeNull();
    expect(getLibrarySearchScore("wrkflw", ["Workflow Generator"])).not.toBeNull();
  });

  it("tolerates small typos and adjacent transpositions", () => {
    expect(getLibrarySearchScore("waek", ["Weak Pattern Matcher"])).not.toBeNull();
    expect(getLibrarySearchScore("wrkflow", ["Workflow Builder"])).not.toBeNull();
  });

  it("ranks stronger matches before weaker matches", () => {
    const results = rankLibrarySearchResults(
      [
        { id: "description", name: "Generic Helper", description: "Creates workflow output" },
        { id: "prefix", name: "Workflow Generator", description: "" },
        { id: "exact", name: "Workflow", description: "" },
      ],
      "workflow",
      (item) => [item.name, item.description],
    );

    expect(results.map((item) => item.id)).toEqual(["exact", "prefix", "description"]);
  });

  it("extracts nested workflow and node payload strings for searching", () => {
    const fields = collectSearchableStrings({
      nodes: [
        {
          data: {
            label: "Review Agent",
            promptText: "Find risky migrations",
            ignored: false,
          },
        },
      ],
    });

    expect(fields).toContain("Review Agent");
    expect(fields).toContain("Find risky migrations");
    expect(fields).not.toContain("false");
  });
});
