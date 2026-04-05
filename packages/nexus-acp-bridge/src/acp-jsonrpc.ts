import type { ACPTransportProtocol } from "./types";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: number;
  result: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcSuccess | JsonRpcFailure;

export class JsonRpcError extends Error {
  constructor(
    message: string,
    readonly code = -32000,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "JsonRpcError";
  }
}

export function encodeJsonRpcMessage(
  message: JsonRpcMessage,
  protocol: ACPTransportProtocol,
): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  if (protocol === "newline") {
    return Buffer.concat([body, Buffer.from("\n", "utf8")]);
  }

  const header = Buffer.from(`Content-Length: ${body.byteLength}\r\n\r\n`, "utf8");
  return Buffer.concat([header, body]);
}

export function decodeJsonRpcMessages(
  buffer: Buffer,
  protocol: ACPTransportProtocol,
): { messages: JsonRpcMessage[]; remainder: Buffer } {
  return protocol === "newline"
    ? decodeNewlineMessages(buffer)
    : decodeContentLengthMessages(buffer);
}

function decodeNewlineMessages(buffer: Buffer): { messages: JsonRpcMessage[]; remainder: Buffer } {
  const messages: JsonRpcMessage[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const newline = buffer.indexOf(0x0a, cursor);
    if (newline === -1) break;
    const line = buffer.slice(cursor, newline).toString("utf8").trim();
    cursor = newline + 1;
    if (!line) continue;
    messages.push(JSON.parse(line) as JsonRpcMessage);
  }

  return { messages, remainder: buffer.slice(cursor) };
}

function decodeContentLengthMessages(buffer: Buffer): { messages: JsonRpcMessage[]; remainder: Buffer } {
  const messages: JsonRpcMessage[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const separator = buffer.indexOf("\r\n\r\n", cursor, "utf8");
    if (separator === -1) break;

    const headerText = buffer.slice(cursor, separator).toString("utf8");
    const contentLengthMatch = headerText.match(/content-length:\s*(\d+)/i);
    if (!contentLengthMatch) {
      throw new JsonRpcError("Missing Content-Length header in JSON-RPC payload");
    }

    const contentLength = Number(contentLengthMatch[1]);
    const bodyStart = separator + 4;
    const bodyEnd = bodyStart + contentLength;
    if (buffer.length < bodyEnd) break;

    const body = buffer.slice(bodyStart, bodyEnd).toString("utf8");
    messages.push(JSON.parse(body) as JsonRpcMessage);
    cursor = bodyEnd;
  }

  return { messages, remainder: buffer.slice(cursor) };
}

export function isJsonRpcFailure(message: JsonRpcMessage): message is JsonRpcFailure {
  return "error" in message;
}

export function isJsonRpcNotification(message: JsonRpcMessage): message is JsonRpcNotification {
  return "method" in message && !("id" in message);
}

