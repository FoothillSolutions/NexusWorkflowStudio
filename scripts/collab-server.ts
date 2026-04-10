import path from "node:path";
import { Server } from "@hocuspocus/server";
import * as Y from "yjs";
import { CollabObjectStore } from "../src/lib/collaboration/object-store";

function readPort(): number {
  const raw = process.env.NEXUS_COLLAB_SERVER_PORT ?? "1234";
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid NEXUS_COLLAB_SERVER_PORT: ${raw}`);
  }
  return port;
}

function readDebounceMs(): number {
  const raw = process.env.NEXUS_COLLAB_STORE_DEBOUNCE_MS ?? "1000";
  const ms = Number(raw);
  if (!Number.isInteger(ms) || ms < 0) {
    throw new Error(`Invalid NEXUS_COLLAB_STORE_DEBOUNCE_MS: ${raw}`);
  }
  return ms;
}

async function main(): Promise<void> {
  const port = readPort();
  const dataDir = process.env.NEXUS_COLLAB_DATA_DIR ?? path.join(process.cwd(), ".nexus-collab");
  const objectStore = new CollabObjectStore(dataDir);

  const server = new Server({
    port,
    debounce: readDebounceMs(),
    maxDebounce: 5000,
    quiet: false,
    onLoadDocument: async ({ documentName }) => {
      return objectStore.load(documentName);
    },
    onStoreDocument: async ({ documentName, document }) => {
      await objectStore.store(documentName, Y.encodeStateAsUpdate(document));
    },
  });

  await server.listen();
}

await main();
