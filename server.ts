// Unified production server: Next.js HTTP + Hocuspocus WebSocket on one port.
//
// The same Node process serves the Next.js app and the collab WebSocket at
// `/collab`. Any reverse proxy / CDN / cloud LB that already forwards HTTP
// and WebSocket to port 3000 will carry collab traffic automatically — no
// extra port to open, no per-deploy config.
//
// Used as the Docker CMD in production. Local `next dev` stays untouched;
// `scripts/start.sh` still spawns the standalone collab server for dev.

import { createServer } from "node:http";
import { parse } from "node:url";
import path from "node:path";
import next from "next";
import { Server as HocuspocusHttpServer } from "@hocuspocus/server";
import type { WebSocket as WsWebSocket } from "ws";
import * as Y from "yjs";
import { CollabObjectStore } from "./src/lib/collaboration/object-store";

const PORT = Number(process.env.PORT ?? 3000);
const HOSTNAME = process.env.HOSTNAME ?? "0.0.0.0";
const COLLAB_PATH = "/collab";

const collabDataDir =
  process.env.NEXUS_COLLAB_DATA_DIR ?? path.join(process.cwd(), ".nexus-collab");
const collabDebounceMs = Number(process.env.NEXUS_COLLAB_STORE_DEBOUNCE_MS ?? 1000);

const objectStore = new CollabObjectStore(collabDataDir);

// Configure Hocuspocus without calling .listen() — we attach its internal
// WebSocketServer to our own HTTP server below so it shares the Next port.
const collab = new HocuspocusHttpServer({
  debounce: collabDebounceMs,
  maxDebounce: 5000,
  quiet: true,
  onLoadDocument: async ({ documentName }: { documentName: string }) =>
    objectStore.load(documentName),
  onStoreDocument: async ({
    documentName,
    document,
  }: {
    documentName: string;
    document: Y.Doc;
  }) => {
    await objectStore.store(documentName, Y.encodeStateAsUpdate(document));
  },
});

const app = next({ dev: false, hostname: HOSTNAME, port: PORT });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url ?? "/", true);
  handle(req, res, parsedUrl);
});

server.on("upgrade", (request, socket, head) => {
  const urlPath = (request.url ?? "").split("?")[0];
  if (urlPath === COLLAB_PATH || urlPath.startsWith(`${COLLAB_PATH}/`)) {
    collab.webSocketServer.handleUpgrade(request, socket, head, (ws: WsWebSocket) => {
      collab.hocuspocus.handleConnection(ws, request);
    });
    return;
  }
  socket.destroy();
});

server.listen(PORT, HOSTNAME, () => {
  console.log(
    `▲ Nexus ready on http://${HOSTNAME}:${PORT} (collab at ws(s)://<host>${COLLAB_PATH})`,
  );
});
