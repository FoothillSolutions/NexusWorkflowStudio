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

function readTtlDays(): number {
  const raw = process.env.NEXUS_COLLAB_ROOM_TTL_DAYS ?? "3";
  const days = Number(raw);
  if (!Number.isFinite(days) || days < 0) {
    throw new Error(`Invalid NEXUS_COLLAB_ROOM_TTL_DAYS: ${raw}`);
  }
  return days;
}

async function main(): Promise<void> {
  const port = readPort();
  const dataDir = process.env.NEXUS_COLLAB_DATA_DIR ?? path.join(process.cwd(), ".nexus-collab");
  const ttlDays = readTtlDays();
  const objectStore = new CollabObjectStore(dataDir);

  // Prune idle rooms on startup and every 24h thereafter. Same policy as
  // the production unified server in server.ts.
  if (ttlDays > 0) {
    const maxAgeMs = ttlDays * 24 * 60 * 60 * 1000;
    const runPrune = async () => {
      try {
        const { pruned, kept } = await objectStore.pruneOlderThan(maxAgeMs);
        if (pruned > 0) {
          console.log(
            `[collab] pruned ${pruned} idle rooms older than ${ttlDays}d (kept ${kept})`,
          );
        }
      } catch (err) {
        console.error("[collab] prune failed:", err);
      }
    };
    void runPrune();
    setInterval(runPrune, 24 * 60 * 60 * 1000).unref();
  }

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
