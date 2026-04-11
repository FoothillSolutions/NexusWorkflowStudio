import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { getSpacetimeUri, getSpacetimeDbName, isSpacetimeConfigured } from "../spacetime/config";

describe("SpacetimeDB config", () => {
  const origUri = process.env.NEXT_PUBLIC_SPACETIME_URI;
  const origDb = process.env.NEXT_PUBLIC_SPACETIME_DB_NAME;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SPACETIME_URI;
    delete process.env.NEXT_PUBLIC_SPACETIME_DB_NAME;
  });

  afterEach(() => {
    if (origUri !== undefined) process.env.NEXT_PUBLIC_SPACETIME_URI = origUri;
    else delete process.env.NEXT_PUBLIC_SPACETIME_URI;
    if (origDb !== undefined) process.env.NEXT_PUBLIC_SPACETIME_DB_NAME = origDb;
    else delete process.env.NEXT_PUBLIC_SPACETIME_DB_NAME;
  });

  it("returns default URI when env var is not set", () => {
    expect(getSpacetimeUri()).toBe("ws://localhost:3001");
  });

  it("returns configured URI from env var", () => {
    process.env.NEXT_PUBLIC_SPACETIME_URI = "wss://prod.example.com";
    expect(getSpacetimeUri()).toBe("wss://prod.example.com");
  });

  it("trims whitespace from URI", () => {
    process.env.NEXT_PUBLIC_SPACETIME_URI = "  ws://trimmed:3001  ";
    expect(getSpacetimeUri()).toBe("ws://trimmed:3001");
  });

  it("returns default DB name when env var is not set", () => {
    expect(getSpacetimeDbName()).toBe("nexus");
  });

  it("returns configured DB name from env var", () => {
    process.env.NEXT_PUBLIC_SPACETIME_DB_NAME = "custom-db";
    expect(getSpacetimeDbName()).toBe("custom-db");
  });

  it("isSpacetimeConfigured returns false when no URI is set", () => {
    expect(isSpacetimeConfigured()).toBe(false);
  });

  it("isSpacetimeConfigured returns true when URI is set", () => {
    process.env.NEXT_PUBLIC_SPACETIME_URI = "ws://localhost:3001";
    expect(isSpacetimeConfigured()).toBe(true);
  });

  it("isSpacetimeConfigured returns false for empty/whitespace URI", () => {
    process.env.NEXT_PUBLIC_SPACETIME_URI = "   ";
    expect(isSpacetimeConfigured()).toBe(false);
  });
});
