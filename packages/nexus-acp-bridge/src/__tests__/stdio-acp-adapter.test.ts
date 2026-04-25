import { describe, expect, test } from "bun:test";
import { StdioACPAdapter } from "../adapters/stdio";
import { makeBridgeConfig, makeGenerateTextRequest } from "./test-helpers";

describe("StdioACPAdapter", () => {
  test("streams stdout from the configured command", async () => {
    const adapter = new StdioACPAdapter(makeBridgeConfig({
      adapterMode: "stdio",
      agentCommand: process.execPath,
      agentArgs: [
        "-e",
        "process.stdin.resume();process.stdin.on('data',()=>{});process.stdout.write('chunk-one ');setTimeout(()=>process.stdout.write('chunk-two'),10);setTimeout(()=>process.exit(0),20);",
      ],
    }));

    let output = "";
    for await (const chunk of adapter.generateText(makeGenerateTextRequest())) {
      output += chunk;
    }

    expect(output).toBe("chunk-one chunk-two");
  });

  test("throws a helpful error when stdio mode lacks a command", async () => {
    const adapter = new StdioACPAdapter(makeBridgeConfig({
      adapterMode: "stdio",
      agentCommand: null,
    }));

    await expect(async () => {
      for await (const _chunk of adapter.generateText(makeGenerateTextRequest())) {
        // consume
      }
    }).toThrow("NEXUS_ACP_BRIDGE_AGENT_COMMAND is required");
  });
});

