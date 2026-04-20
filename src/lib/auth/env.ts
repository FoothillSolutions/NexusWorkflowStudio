import { z } from "zod/v4";

// ── Zod schema for auth environment variables ───────────────────────────────

const authEnvSchema = z.object({
  AUTH_ISSUER: z.url(),
  AUTH_CLIENT_ID: z.string().min(1),
  AUTH_CLIENT_SECRET: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_PROVIDER_NAME: z.string().optional().default("SSO"),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

// ── Required env var keys ───────────────────────────────────────────────────

const REQUIRED_KEYS = [
  "AUTH_ISSUER",
  "AUTH_CLIENT_ID",
  "AUTH_CLIENT_SECRET",
  "AUTH_SECRET",
] as const;

// ── Cached results ──────────────────────────────────────────────────────────

let _cachedEnabled: boolean | undefined;
let _cachedEnv: AuthEnv | undefined;

/**
 * Quick boolean check — returns `true` when all four required AUTH_* vars are
 * present. Does NOT validate values (use `getAuthEnv()` for that).
 *
 * The result is cached at module level so the middleware hot-path pays no
 * repeated cost.
 */
export function isAuthEnabled(): boolean {
  if (_cachedEnabled !== undefined) return _cachedEnabled;

  const present = REQUIRED_KEYS.filter((k) => !!process.env[k]);
  const missing = REQUIRED_KEYS.filter((k) => !process.env[k]);

  if (present.length > 0 && missing.length > 0) {
    console.warn(
      `[auth] Partial auth configuration detected. Present: ${present.join(", ")}. ` +
        `Missing: ${missing.join(", ")}. Authentication is DISABLED. ` +
        `Set all four variables to enable OIDC/OAuth2.`,
    );
  }

  _cachedEnabled = missing.length === 0;
  return _cachedEnabled;
}

/**
 * Parse and validate the full set of auth environment variables.
 * Throws a `ZodError` if validation fails. Only call when `isAuthEnabled()`
 * returns `true`.
 */
export function getAuthEnv(): AuthEnv {
  if (_cachedEnv) return _cachedEnv;

  _cachedEnv = authEnvSchema.parse({
    AUTH_ISSUER: process.env.AUTH_ISSUER,
    AUTH_CLIENT_ID: process.env.AUTH_CLIENT_ID,
    AUTH_CLIENT_SECRET: process.env.AUTH_CLIENT_SECRET,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_PROVIDER_NAME: process.env.AUTH_PROVIDER_NAME,
  });

  return _cachedEnv;
}

/**
 * Reset cached state. Intended for tests only.
 * @internal
 */
export function _resetCache(): void {
  _cachedEnabled = undefined;
  _cachedEnv = undefined;
}
