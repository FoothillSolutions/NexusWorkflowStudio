import { describe, expect, test } from "bun:test";
import { decodeJsonRpcMessages, encodeJsonRpcMessage } from "../acp-jsonrpc";

describe("acp json-rpc framing", () => {
  test("round-trips content-length framed messages", () => {
    const payload = {
      jsonrpc: "2.0" as const,
      id: 1,
      method: "ping",
      params: { ok: true },
    };

    const encoded = encodeJsonRpcMessage(payload, "content-length");
    const decoded = decodeJsonRpcMessages(encoded, "content-length");

    expect(decoded.messages).toEqual([payload]);
    expect(decoded.remainder.byteLength).toBe(0);
  });

  test("round-trips newline framed messages", () => {
    const payload = {
      jsonrpc: "2.0" as const,
      method: "note",
      params: { value: "x" },
    };

    const encoded = encodeJsonRpcMessage(payload, "newline");
    const decoded = decodeJsonRpcMessages(encoded, "newline");

    expect(decoded.messages).toEqual([payload]);
    expect(decoded.remainder.byteLength).toBe(0);
  });
});

