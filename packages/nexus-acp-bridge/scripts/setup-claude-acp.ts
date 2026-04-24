#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLAUDE_CODE_PINNED_VERSION = "2.0.20";
const ACP_CLAUDE_CODE_VERSION = "^0.8.0";

const here = path.dirname(fileURLToPath(import.meta.url));
const vendorDir = path.resolve(here, "..", "vendor", "claude-code");
const binPath = path.join(vendorDir, "node_modules", ".bin", "acp-claude-code");

function log(message: string): void {
  console.log(`[setup-claude-acp] ${message}`);
}

const force = process.argv.includes("--force");

if (fs.existsSync(binPath) && !force) {
  log(`already installed at ${binPath}`);
  log("pass --force to reinstall.");
  process.exit(0);
}

fs.mkdirSync(vendorDir, { recursive: true });

const manifest = {
  name: "nexus-acp-bridge-vendored-claude-code",
  private: true,
  version: "0.0.0",
  dependencies: {
    "acp-claude-code": ACP_CLAUDE_CODE_VERSION,
    "@anthropic-ai/claude-code": CLAUDE_CODE_PINNED_VERSION,
  },
  overrides: {
    "@anthropic-ai/claude-code": CLAUDE_CODE_PINNED_VERSION,
  },
} as const;

fs.writeFileSync(
  path.join(vendorDir, "package.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8",
);

log(`vendoring acp-claude-code + @anthropic-ai/claude-code@${CLAUDE_CODE_PINNED_VERSION} in ${vendorDir}`);
log("running npm install...");

const installResult = spawnSync("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], {
  cwd: vendorDir,
  stdio: "inherit",
  env: process.env,
});

if (installResult.status !== 0) {
  log(`npm install failed with exit code ${installResult.status ?? "unknown"}`);
  process.exit(installResult.status ?? 1);
}

if (!fs.existsSync(binPath)) {
  log(`install reported success but ${binPath} is missing`);
  process.exit(1);
}

log(`installed at ${binPath}`);
log("The claude-code preset will now pick this up automatically.");
