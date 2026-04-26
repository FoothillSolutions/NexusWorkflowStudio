import { describe, expect, it } from "bun:test";
import { StreamingActionParser } from "../streaming-action-parser";

describe("StreamingActionParser", () => {
  it("parses a complete action", () => { const p = new StreamingActionParser(); expect(p.push('<action name="listNodes"><args>{}</args></action>').calls[0]?.name).toBe("listNodes"); });
  it("parses split actions", () => { const p = new StreamingActionParser(); expect(p.push('<action name="list').calls).toHaveLength(0); expect(p.push('Nodes"><args>{}</args></action>').calls).toHaveLength(1); });
  it("parses multiple actions", () => { const p = new StreamingActionParser(); expect(p.push('<action name="a"><args>{}</args></action><action name="b"><args>{}</args></action>').calls.map((c) => c.name)).toEqual(["a", "b"]); });
  it("ignores fenced code", () => { const p = new StreamingActionParser(); expect(p.push('```xml\n<action name="a"><args>{}</args></action>\n```').calls).toHaveLength(0); });
  it("surfaces malformed args", () => { const p = new StreamingActionParser(); expect(p.push('<action name="a"><args>{bad</args></action>').calls[0]?.error).toBeTruthy(); });
  it("preserves prose for display", () => { const p = new StreamingActionParser(); expect(p.push("hello").displayText).toBe("hello"); });
});
