import { ACPProtocolAdapter } from "./acp-protocol-adapter";
import { loadBridgeConfig } from "./config";
import { MockACPAdapter } from "./mock-acp-adapter";
import { StdioACPAdapter } from "./stdio-acp-adapter";
import { NexusACPBridgeServer } from "./server";
import type { ACPAdapter, BridgeConfig } from "./types";

function createAdapter(config: BridgeConfig): ACPAdapter {
  return config.adapterMode === "acp"
    ? new ACPProtocolAdapter(config)
    : config.adapterMode === "stdio"
      ? new StdioACPAdapter(config)
      : new MockACPAdapter(config);
}

const config = loadBridgeConfig();
const adapter = createAdapter(config);
const server = new NexusACPBridgeServer(config, adapter).start();

console.log(`[nexus-acp-bridge] listening on http://${server.hostname}:${server.port}`);
console.log(`[nexus-acp-bridge] adapter mode: ${config.adapterMode}`);
console.log(`[nexus-acp-bridge] selected tool: ${config.selectedTool ?? "custom"}`);
console.log(`[nexus-acp-bridge] CORS origin: ${config.corsOrigin}`);
console.log(`[nexus-acp-bridge] Project roots: ${config.projectDirs.join(", ")}`);

