import { describe, expect, it, beforeEach, afterEach, spyOn } from "bun:test";
import { isAuthEnabled, getAuthEnv, _resetCache } from "../env";

const VALID_ENV = {
  AUTH_ISSUER: "https://login.microsoftonline.com/tenant-id/v2.0",
  AUTH_CLIENT_ID: "test-client-id",
  AUTH_CLIENT_SECRET: "test-client-secret",
  AUTH_SECRET: "a]3Kz!9vR$mN#wP7xQ2yB&fJ5hL@dT8cUeA",
  AUTH_PROVIDER_NAME: "Microsoft",
};

describe("isAuthEnabled", () => {
  beforeEach(() => {
    _resetCache();
  });

  afterEach(() => {
    _resetCache();
    // Clean up env vars
    for (const key of Object.keys(VALID_ENV)) {
      delete process.env[key];
    }
  });

  it("returns false when no auth env vars are set", () => {
    expect(isAuthEnabled()).toBe(false);
  });

  it("returns true when all required vars are present", () => {
    Object.assign(process.env, VALID_ENV);
    expect(isAuthEnabled()).toBe(true);
  });

  it("returns false with partial vars and logs a warning", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    process.env.AUTH_ISSUER = VALID_ENV.AUTH_ISSUER;
    process.env.AUTH_CLIENT_ID = VALID_ENV.AUTH_CLIENT_ID;
    // AUTH_CLIENT_SECRET and AUTH_SECRET missing

    expect(isAuthEnabled()).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("Partial auth configuration");
    expect(warnSpy.mock.calls[0][0]).toContain("AUTH_CLIENT_SECRET");
    expect(warnSpy.mock.calls[0][0]).toContain("AUTH_SECRET");

    warnSpy.mockRestore();
  });

  it("caches the result after the first call", () => {
    Object.assign(process.env, VALID_ENV);
    expect(isAuthEnabled()).toBe(true);

    // Remove env vars — cached result should still return true
    for (const key of Object.keys(VALID_ENV)) {
      delete process.env[key];
    }
    expect(isAuthEnabled()).toBe(true);
  });
});

describe("getAuthEnv", () => {
  beforeEach(() => {
    _resetCache();
  });

  afterEach(() => {
    _resetCache();
    for (const key of Object.keys(VALID_ENV)) {
      delete process.env[key];
    }
  });

  it("returns parsed config when all vars are valid", () => {
    Object.assign(process.env, VALID_ENV);
    const env = getAuthEnv();

    expect(env.AUTH_ISSUER).toBe(VALID_ENV.AUTH_ISSUER);
    expect(env.AUTH_CLIENT_ID).toBe(VALID_ENV.AUTH_CLIENT_ID);
    expect(env.AUTH_CLIENT_SECRET).toBe(VALID_ENV.AUTH_CLIENT_SECRET);
    expect(env.AUTH_SECRET).toBe(VALID_ENV.AUTH_SECRET);
    expect(env.AUTH_PROVIDER_NAME).toBe("Microsoft");
  });

  it("defaults AUTH_PROVIDER_NAME to SSO when not set", () => {
    const { AUTH_PROVIDER_NAME: _, ...envWithoutName } = VALID_ENV;
    Object.assign(process.env, envWithoutName);
    const env = getAuthEnv();

    expect(env.AUTH_PROVIDER_NAME).toBe("SSO");
  });

  it("throws on invalid issuer URL", () => {
    Object.assign(process.env, { ...VALID_ENV, AUTH_ISSUER: "not-a-url" });
    expect(() => getAuthEnv()).toThrow();
  });

  it("throws when AUTH_SECRET is shorter than 32 characters", () => {
    Object.assign(process.env, { ...VALID_ENV, AUTH_SECRET: "too-short" });
    expect(() => getAuthEnv()).toThrow();
  });

  it("throws when AUTH_CLIENT_ID is empty", () => {
    Object.assign(process.env, { ...VALID_ENV, AUTH_CLIENT_ID: "" });
    expect(() => getAuthEnv()).toThrow();
  });
});
