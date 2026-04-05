import { loadBridgeConfig } from "./config";
import { MockACPAdapter } from "./mock-acp-adapter";
import { RealACPAdapter } from "./real-acp-adapter";
import { StdioACPAdapter } from "./stdio-acp-adapter";
import { NexusACPBridgeServer } from "./server";

const config = loadBridgeConfig();
const adapter = config.adapterMode === "acp"
  ? new RealACPAdapter(config)
  : config.adapterMode === "stdio"
    ? new StdioACPAdapter(config)
    : new MockACPAdapter(config);
const server = new NexusACPBridgeServer(config, adapter).start();

console.log(`[nexus-acp-bridge] listening on http://${server.hostname}:${server.port}`);
console.log(`[nexus-acp-bridge] adapter mode: ${config.adapterMode}`);
console.log(`[nexus-acp-bridge] CORS origin: ${config.corsOrigin}`);
console.log(`[nexus-acp-bridge] Project roots: ${config.projectDirs.join(", ")}`);

