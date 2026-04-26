import { describe, expect, it } from "bun:test";
import { dispatchTool, getToolCatalog } from "../tools";

describe("sidekick tools", () => {
  it("lists tool catalog", () => { expect(getToolCatalog().some((t) => t.name === "listNodes")).toBe(true); });
  it("returns unknown_tool", async () => { const r = await dispatchTool({ id: "x", name: "nope", args: {}, raw: "" }); expect(r.error?.code).toBe("unknown_tool"); });
  it("returns invalid_args", async () => { const r = await dispatchTool({ id: "x", name: "getNode", args: {}, raw: "" }); expect(r.error?.code).toBe("invalid_args"); });
  it("protects start deletion", async () => { const nodes = (await dispatchTool({ id: "n", name: "listNodes", args: {}, raw: "" })).result as Array<{ id: string; data: { type: string } }>; const start = nodes.find((n) => n.data.type === "start"); if (start) { const r = await dispatchTool({ id: "d", name: "deleteNode", args: { id: start.id }, raw: "" }); expect(r.error?.code).toBe("node_not_deletable"); } });
});
