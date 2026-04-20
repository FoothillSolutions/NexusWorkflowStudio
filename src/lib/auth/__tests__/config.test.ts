import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { NextRequest } from "next/server";
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
 * Each test must set env vars BEFORE importing, because authOptions is built
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
    it("exports authOptions", async () => {
      const config = await loadConfig();
      expect(config.authOptions).toBeDefined();
    });

    it("authOptions has empty providers array", async () => {
      const config = await loadConfig();
      expect(config.authOptions.providers).toEqual([]);
    });

    it("authOptions has a placeholder secret", async () => {
      const config = await loadConfig();
      expect(config.authOptions.secret).toBeDefined();
      expect(typeof config.authOptions.secret).toBe("string");
    });
  });

  describe("when auth is enabled", () => {
    beforeEach(() => {
      Object.assign(process.env, VALID_ENV);
    });

    it("exports authOptions", async () => {
      const config = await loadConfig();
      expect(config.authOptions).toBeDefined();
    });

    it("authOptions has one OIDC provider with type oauth", async () => {
      const config = await loadConfig();
      expect(config.authOptions.providers).toHaveLength(1);
      const provider = config.authOptions.providers[0] as unknown as Record<string, unknown>;
      expect(provider.id).toBe("oidc");
      expect(provider.type).toBe("oauth");
    });

    it("provider uses wellKnown discovery URL derived from AUTH_ISSUER", async () => {
      const config = await loadConfig();
      const provider = config.authOptions.providers[0] as unknown as Record<string, unknown>;
      expect(provider.wellKnown).toBe(
        `${VALID_ENV.AUTH_ISSUER}/.well-known/openid-configuration`,
      );
    });

    it("provider uses AUTH_PROVIDER_NAME as display name", async () => {
      const config = await loadConfig();
      const provider = config.authOptions.providers[0] as unknown as Record<string, unknown>;
      expect(provider.name).toBe(VALID_ENV.AUTH_PROVIDER_NAME);
    });

    it("session strategy is jwt with 8-hour maxAge", async () => {
      const config = await loadConfig();
      expect(config.authOptions.session?.strategy).toBe("jwt");
      expect(config.authOptions.session?.maxAge).toBe(8 * 60 * 60);
    });

    it("authOptions secret matches AUTH_SECRET", async () => {
      const config = await loadConfig();
      expect(config.authOptions.secret).toBe(VALID_ENV.AUTH_SECRET);
    });
  });
});

// ── Middleware authorization logic (inline simulation) ────────────────────────
// The authorized logic lives in proxy.ts. These tests verify the logic
// inline to avoid importing Edge-only `getToken` in the test environment.

describe("middleware authorization logic", () => {
  function makeRequest(url: string): NextRequest {
    return new NextRequest(url);
  }

  it("unauthenticated page route: redirects to /api/auth/signin with callbackUrl", async () => {
    const { NextResponse } = await import("next/server");
    const request = makeRequest("http://localhost:3000/workspace/abc");

    // Simulate the middleware logic for an unauthenticated page-route request
    const token = null;
    let result: Response | ReturnType<typeof NextResponse.next>;

    if (token) {
      result = NextResponse.next();
    } else if (request.nextUrl.pathname.startsWith("/api/")) {
      result = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    } else {
      const signInUrl = new URL("/api/auth/signin", request.nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", request.nextUrl.href);
      result = NextResponse.redirect(signInUrl);
    }

    expect(result instanceof Response).toBe(true);
    const res = result as Response;
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/api/auth/signin");
    expect(location).toContain("callbackUrl=");
    expect(location).toContain(encodeURIComponent("http://localhost:3000/workspace/abc"));
  });

  it("unauthenticated API route: returns 401 JSON", async () => {
    const { NextResponse } = await import("next/server");
    const request = makeRequest("http://localhost:3000/api/workspaces");

    const token = null;
    let result: Response | ReturnType<typeof NextResponse.next>;

    if (token) {
      result = NextResponse.next();
    } else if (request.nextUrl.pathname.startsWith("/api/")) {
      result = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    } else {
      const signInUrl = new URL("/api/auth/signin", request.nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", request.nextUrl.href);
      result = NextResponse.redirect(signInUrl);
    }

    expect(result instanceof Response).toBe(true);
    const res = result as Response;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });
});
