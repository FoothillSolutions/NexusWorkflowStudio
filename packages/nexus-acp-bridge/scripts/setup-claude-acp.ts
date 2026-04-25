#!/usr/bin/env bun
import fs from "node:fs";
import { CLAUDE_VENDOR_BIN, ensureClaudeAcpVendored } from "../src/vendor-claude-acp";

function log(message: string): void {
  console.log(`[setup-claude-acp] ${message}`);
}

const force = process.argv.includes("--force");
const alreadyInstalled = fs.existsSync(CLAUDE_VENDOR_BIN);

if (alreadyInstalled && !force) {
  log(`already installed at ${CLAUDE_VENDOR_BIN}`);
  log("pass --force to reinstall.");
  process.exit(0);
}

try {
  ensureClaudeAcpVendored({ force, log });
  log("The claude-code preset will now pick this up automatically.");
} catch (error) {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
