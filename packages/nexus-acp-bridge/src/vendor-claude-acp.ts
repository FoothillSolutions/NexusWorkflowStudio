import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CLAUDE_AGENT_ACP_VERSION = "0.31.0";

const here = path.dirname(fileURLToPath(import.meta.url));
export const CLAUDE_VENDOR_DIR = path.resolve(here, "..", "vendor", "claude-code");
export const CLAUDE_VENDOR_BIN = path.join(
  CLAUDE_VENDOR_DIR,
  "node_modules",
  ".bin",
  "claude-agent-acp",
);

export interface EnsureClaudeAcpOptions {
  force?: boolean;
  /** When true, swallow install failures and return null. */
  silent?: boolean;
  log?: (message: string) => void;
}

/**
 * Ensure `@agentclientprotocol/claude-agent-acp` is vendored locally and return
 * the absolute path to its CLI binary. When the binary is already present and
 * `force` is false, this is a no-op.
 *
 * Returns the binary path on success, or `null` when `silent` is true and the
 * install failed.
 */
export function ensureClaudeAcpVendored(options: EnsureClaudeAcpOptions = {}): string | null {
  const log = options.log ?? ((msg: string) => console.log(`[setup-claude-acp] ${msg}`));

  if (fs.existsSync(CLAUDE_VENDOR_BIN) && !options.force) {
    return CLAUDE_VENDOR_BIN;
  }

  fs.mkdirSync(CLAUDE_VENDOR_DIR, { recursive: true });

  const manifest = {
    name: "nexus-acp-bridge-vendored-claude-code",
    private: true,
    version: "0.0.0",
    dependencies: {
      "@agentclientprotocol/claude-agent-acp": CLAUDE_AGENT_ACP_VERSION,
    },
  } as const;

  fs.writeFileSync(
    path.join(CLAUDE_VENDOR_DIR, "package.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );

  log(`vendoring @agentclientprotocol/claude-agent-acp@${CLAUDE_AGENT_ACP_VERSION} in ${CLAUDE_VENDOR_DIR}`);
  log("running npm install...");

  const installResult = spawnSync(
    "npm",
    ["install", "--no-audit", "--no-fund", "--loglevel=error"],
    {
      cwd: CLAUDE_VENDOR_DIR,
      stdio: "inherit",
      env: process.env,
    },
  );

  if (installResult.status !== 0) {
    const message = `npm install failed with exit code ${installResult.status ?? "unknown"}`;
    if (options.silent) {
      log(message);
      return null;
    }
    throw new Error(message);
  }

  if (!fs.existsSync(CLAUDE_VENDOR_BIN)) {
    const message = `install reported success but ${CLAUDE_VENDOR_BIN} is missing`;
    if (options.silent) {
      log(message);
      return null;
    }
    throw new Error(message);
  }

  log(`installed at ${CLAUDE_VENDOR_BIN}`);
  return CLAUDE_VENDOR_BIN;
}

