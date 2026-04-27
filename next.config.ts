import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No `output: "standalone"` — the production Docker image runs a custom
  // server (server.ts) that combines Next.js and the Hocuspocus WebSocket
  // on a single port, which needs the full `.next/` build output.
};

export default nextConfig;
