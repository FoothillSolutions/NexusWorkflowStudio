#!/usr/bin/env bun
import { createAdapter } from "./index";
import { loadBridgeConfig } from "./config";
import { NexusACPBridgeServer } from "./server/http-server";

const config = loadBridgeConfig();
const adapter = createAdapter(config);
const bridge = new NexusACPBridgeServer(config, adapter);
const server = bridge.start();

console.log(`[nexus-acp-bridge] listening on http://${server.hostname}:${server.port}`);
if (bridge.usedRandomPortFallback()) {
  console.warn(
    `[nexus-acp-bridge] port ${config.port} was already in use; fell back to random port ${server.port}`,
  );
}
console.log(`[nexus-acp-bridge] adapter mode: ${config.adapterMode}`);
console.log(`[nexus-acp-bridge] selected tool: ${config.selectedTool ?? "custom"}`);
console.log(`[nexus-acp-bridge] CORS origin: ${config.corsOrigin}`);
console.log(`[nexus-acp-bridge] Project roots: ${config.projectDirs.join(", ")}`);
