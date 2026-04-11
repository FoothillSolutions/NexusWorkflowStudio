#!/usr/bin/env bun
/**
 * Idempotent migration script: reads existing filesystem workspace + brain data
 * and imports it into SpacetimeDB via reducer calls.
 *
 * Usage:
 *   bun scripts/migrate-to-spacetime.ts [--data-dir <path>] [--spacetime-uri <uri>] [--db-name <name>]
 *
 * The script:
 * 1. Reads workspace manifests from <dataDir>/workspaces/
 * 2. Reads workflow JSON files for each workspace
 * 3. Reads brain manifest from <dataDir>/manifest.json
 * 4. Calls SpacetimeDB import reducers for each item
 * 5. Preserves existing IDs so workspace URLs keep working
 * 6. Is idempotent — safe to re-run (checks for existing rows)
 */

import path from "node:path";
import fs from "node:fs/promises";

// ── Configuration ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const DATA_DIR = getArg("data-dir", process.env.NEXUS_BRAIN_DATA_DIR ?? path.join(process.cwd(), ".nexus-brain"));
const SPACETIME_URI = getArg("spacetime-uri", process.env.NEXT_PUBLIC_SPACETIME_URI ?? "ws://localhost:3001");
const DB_NAME = getArg("db-name", process.env.NEXT_PUBLIC_SPACETIME_DB_NAME ?? "nexus");
const DISPLAY_NAME = getArg("display-name", "migration-script");

const WORKSPACES_DIR = path.join(DATA_DIR, "workspaces");

// ── Stats ──────────────────────────────────────────────────────────────────

const imported = { workspaces: 0, workflows: 0, brainDocs: 0 };
const skipped = { workspaces: 0, workflows: 0, brainDocs: 0 };
const failed = { workspaces: 0, workflows: 0, brainDocs: 0 };

// ── SpacetimeDB WebSocket Client ───────────────────────────────────────────

class MigrationClient {
  private ws: WebSocket | null = null;
  private pendingCalls = new Map<number, { resolve: () => void; reject: (err: Error) => void }>();
  private callId = 0;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${SPACETIME_URI.replace("ws://", "http://").replace("wss://", "https://")}/database/subscribe/${DB_NAME}`;
      const wsUrl = url.replace("http://", "ws://").replace("https://", "wss://");

      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error(`Failed to connect to SpacetimeDB at ${SPACETIME_URI}`));
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "transaction_update") {
            // Resolve any pending call
            for (const [id, handler] of this.pendingCalls) {
              handler.resolve();
              this.pendingCalls.delete(id);
            }
          }
        } catch {
          // ignore
        }
      };
    });
  }

  async callReducer(name: string, args: unknown[]): Promise<void> {
    if (!this.ws) throw new Error("Not connected");

    this.ws.send(JSON.stringify({
      type: "call_reducer",
      reducer: name,
      args,
    }));

    // Wait a brief moment for the reducer to process
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}

// ── Migration Logic ────────────────────────────────────────────────────────

interface WorkspaceManifest {
  version: 1;
  workspace: { id: string; name: string; createdAt: string; updatedAt: string };
  workflows: Array<{
    id: string;
    workspaceId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    lastModifiedBy: string;
  }>;
}

interface BrainManifest {
  version: 1;
  workspaces: Array<{ id: string; createdAt: string; updatedAt: string }>;
  documents: Array<{
    id: string;
    workspaceId: string;
    title: string;
    deletedAt: string | null;
    [key: string]: unknown;
  }>;
  versions: Array<unknown>;
  feedback: Array<unknown>;
}

async function migrateWorkspaces(client: MigrationClient): Promise<void> {
  const exists = await fs.stat(WORKSPACES_DIR).catch(() => null);
  if (!exists) {
    console.log("  No workspaces directory found, skipping workspace migration.");
    return;
  }

  const entries = await fs.readdir(WORKSPACES_DIR, { withFileTypes: true });
  const workspaceDirs = entries.filter((e) => e.isDirectory());

  for (const dir of workspaceDirs) {
    const manifestPath = path.join(WORKSPACES_DIR, dir.name, "manifest.json");
    try {
      const raw = await fs.readFile(manifestPath, "utf8");
      const manifest = JSON.parse(raw) as WorkspaceManifest;
      const ws = manifest.workspace;

      console.log(`  Importing workspace: ${ws.name} (${ws.id})`);

      try {
        await client.callReducer("import_workspace", [
          ws.id,
          ws.name,
          ws.createdAt,
          ws.updatedAt,
          DISPLAY_NAME,
        ]);
        imported.workspaces++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("already exists")) {
          skipped.workspaces++;
          console.log(`    Skipped (already exists)`);
        } else {
          failed.workspaces++;
          console.error(`    Failed: ${msg}`);
        }
      }

      // Import workflows
      for (const wf of manifest.workflows) {
        await migrateWorkflow(client, ws.id, wf);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Failed to read manifest for ${dir.name}: ${msg}`);
      failed.workspaces++;
    }
  }
}

async function migrateWorkflow(
  client: MigrationClient,
  workspaceId: string,
  wfRecord: WorkspaceManifest["workflows"][number],
): Promise<void> {
  const workflowPath = path.join(
    WORKSPACES_DIR,
    workspaceId,
    "workflows",
    `${wfRecord.id}.json`,
  );

  try {
    const raw = await fs.readFile(workflowPath, "utf8");
    const wfData = JSON.parse(raw) as {
      name?: string;
      nodes?: Array<{ id: string; type?: string; position?: { x: number; y: number }; data?: unknown }>;
      edges?: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; data?: unknown }>;
      ui?: Record<string, unknown>;
    };

    console.log(`    Importing workflow: ${wfRecord.name} (${wfRecord.id})`);

    // Convert nodes to SpacetimeDB format
    const nodesPayload = (wfData.nodes ?? []).map((n) => ({
      nodeId: n.id,
      type: n.type ?? "default",
      positionJson: JSON.stringify(n.position ?? { x: 0, y: 0 }),
      dataJson: JSON.stringify(n.data ?? {}),
    }));

    // Convert edges to SpacetimeDB format
    const edgesPayload = (wfData.edges ?? []).map((e) => ({
      edgeId: e.id,
      source: e.source,
      target: e.target,
      handlesJson: JSON.stringify({
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
      }),
      dataJson: e.data ? JSON.stringify(e.data) : "{}",
    }));

    const uiStateJson = wfData.ui ? JSON.stringify(wfData.ui) : "{}";

    try {
      await client.callReducer("import_workflow_snapshot", [
        wfRecord.id,
        workspaceId,
        wfRecord.name,
        JSON.stringify(nodesPayload),
        JSON.stringify(edgesPayload),
        uiStateJson,
        wfRecord.createdAt,
        wfRecord.updatedAt,
        wfRecord.lastModifiedBy,
      ]);
      imported.workflows++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already exists")) {
        skipped.workflows++;
        console.log(`      Skipped (already exists)`);
      } else {
        failed.workflows++;
        console.error(`      Failed: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    Failed to read workflow ${wfRecord.id}: ${msg}`);
    failed.workflows++;
  }
}

async function migrateBrainDocs(client: MigrationClient): Promise<void> {
  const manifestPath = path.join(DATA_DIR, "manifest.json");
  const exists = await fs.stat(manifestPath).catch(() => null);
  if (!exists) {
    console.log("  No brain manifest found, skipping brain doc migration.");
    return;
  }

  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw) as BrainManifest;

    for (const doc of manifest.documents) {
      if (doc.deletedAt) {
        console.log(`    Skipping deleted doc: ${doc.title} (${doc.id})`);
        skipped.brainDocs++;
        continue;
      }

      console.log(`    Importing brain doc: ${doc.title} (${doc.id})`);

      // Extract content fields (everything except workspace/deletion metadata)
      const { id, workspaceId, title, deletedAt: _da, ...contentFields } = doc;
      const contentJson = JSON.stringify(contentFields);

      try {
        await client.callReducer("import_brain_doc", [
          id,
          workspaceId,
          title,
          contentJson,
          (contentFields as Record<string, string>).createdAt ?? new Date().toISOString(),
          (contentFields as Record<string, string>).updatedAt ?? new Date().toISOString(),
        ]);
        imported.brainDocs++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("already exists")) {
          skipped.brainDocs++;
          console.log(`      Skipped (already exists)`);
        } else {
          failed.brainDocs++;
          console.error(`      Failed: ${msg}`);
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  Failed to read brain manifest: ${msg}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("SpacetimeDB Migration Script");
  console.log("============================");
  console.log(`  Data directory: ${DATA_DIR}`);
  console.log(`  SpacetimeDB URI: ${SPACETIME_URI}`);
  console.log(`  Database name: ${DB_NAME}`);
  console.log();

  const client = new MigrationClient();

  console.log("Connecting to SpacetimeDB...");
  try {
    await client.connect();
    console.log("Connected.");
  } catch (err) {
    console.error(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  console.log();
  console.log("Migrating workspaces...");
  await migrateWorkspaces(client);

  console.log();
  console.log("Migrating brain documents...");
  await migrateBrainDocs(client);

  client.disconnect();

  console.log();
  console.log("Migration Complete");
  console.log("==================");
  console.log(`  Workspaces: ${imported.workspaces} imported, ${skipped.workspaces} skipped, ${failed.workspaces} failed`);
  console.log(`  Workflows:  ${imported.workflows} imported, ${skipped.workflows} skipped, ${failed.workflows} failed`);
  console.log(`  Brain Docs: ${imported.brainDocs} imported, ${skipped.brainDocs} skipped, ${failed.brainDocs} failed`);

  if (failed.workspaces + failed.workflows + failed.brainDocs > 0) {
    console.log();
    console.log("Some items failed to migrate. Review the output above for details.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
