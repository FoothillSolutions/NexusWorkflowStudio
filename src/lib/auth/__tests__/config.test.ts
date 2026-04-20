import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { _resetCache } from "../env";

const VALID_ENV = {
  AUTH_ISSUER: "https://login.microsoftonline.com/tenant-id/v2.0",
  AUTH_CLIENT_ID: "test-client-id",
  AUTH_CLIENT_SECRET: "test-client-secret",
  AUTH_SECRET: "a]3Kz!9vR$mN#wP7xQ2yB&fJ5hL@dT8cUeA",
  AUTH_PROVIDER_NAME: "TestProvider",
};

/**
 * Dynamically import the config module to pick up the current env state.
 * Each test must set env vars BEFORE importing, because NextAuth() is called
 * at module-evaluation time.
 */
async function loadConfig() {
  // Bust the module cache so the config re-evaluates with current env
  const modulePath = require.resolve("../config");
  delete require.cache[modulePath];
  // Also bust env cache
  _resetCache();
  return import("../config");
}

describe("auth config", () => {
  afterEach(() => {
    _resetCache();
    for (const key of Object.keys(VALID_ENV)) {
      delete process.env[key];
    }
  });

  describe("when auth is disabled", () => {
    it("exports auth, handlers, signIn, signOut", async () => {
      const config = await loadConfig();
      expect(config.auth).toBeDefined();
      expect(config.handlers).toBeDefined();
      expect(config.signIn).toBeDefined();
      expect(config.signOut).toBeDefined();
    });
  });

  describe("when auth is enabled", () => {
    beforeEach(() => {
      Object.assign(process.env, VALID_ENV);
    });

    it("exports auth, handlers, signIn, signOut", async () => {
      const config = await loadConfig();
      expect(config.auth).toBeDefined();
      expect(config.handlers).toBeDefined();
      expect(config.signIn).toBeDefined();
      expect(config.signOut).toBeDefined();
    });
  });
});
