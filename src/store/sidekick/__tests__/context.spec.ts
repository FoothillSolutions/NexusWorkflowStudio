import { describe, expect, it } from "bun:test";
import { buildToolResultMessage, buildViewSnapshot } from "../context";

describe("sidekick context", () => {
  it("builds compact view snapshot", () => { const s = buildViewSnapshot(); expect(s).toContain("<view-snapshot>"); expect(s).toContain("workflow.nodes.count="); });
  it("builds deterministic tool-result blocks", () => { expect(buildToolResultMessage([{ id: "1", name: "listNodes", ok: true, result: { count: 0 } }])).toContain('<tool-result id="1" name="listNodes" ok="true">'); });
});
