/**
 * Public entrypoint for the `nexus-acp-bridge` package.
 *
 * Re-exports the bridge server, adapters, configuration helpers, and shared
 * types so consumers can embed the bridge programmatically. The CLI lives in
 * `./bin.ts` and is the intended way to launch the bridge from the command
 * line (`bun run nexus-acp-bridge`).
 */

// Server
export { NexusACPBridgeServer } from "./server/http-server";

// Adapters
export { MockACPAdapter } from "./adapters/mock";
export { StdioACPAdapter } from "./adapters/stdio";
export { ACPProtocolAdapter } from "./adapters/acp-protocol";

// Configuration
export { loadBridgeConfig } from "./config";
export {
  BRIDGE_TOOL_PRESET_IDS,
  getBridgeToolPreset,
  type BridgeToolPreset,
} from "./tool-presets";

// Shared types
export type {
  ACPAdapter,
  BridgeConfig,
  Command,
  ConfigProviders,
  GenerateTextRequest,
  HealthInfo,
  MCPStatus,
  McpResource,
  Model,
  Project,
  Provider,
  ToolListItem,
} from "./types";

import type { ACPAdapter, BridgeConfig } from "./types";
import { MockACPAdapter } from "./adapters/mock";
import { StdioACPAdapter } from "./adapters/stdio";
import { ACPProtocolAdapter } from "./adapters/acp-protocol";

/** Construct the adapter implied by `config.adapterMode`. */
export function createAdapter(config: BridgeConfig): ACPAdapter {
  switch (config.adapterMode) {
    case "acp":
      return new ACPProtocolAdapter(config);
    case "stdio":
      return new StdioACPAdapter(config);
    case "mock":
    default:
      return new MockACPAdapter(config);
  }
}

