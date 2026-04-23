import type { NextAuthOptions } from "next-auth";
import { isAuthEnabled, getAuthEnv } from "./env";

const PLACEHOLDER_SECRET = "nexus-auth-disabled-no-secret-required";

function buildAuthOptions(): NextAuthOptions {
  if (!isAuthEnabled()) {
    return {
      secret: PLACEHOLDER_SECRET,
      providers: [],
    };
  }

  const env = getAuthEnv();

  return {
    secret: env.AUTH_SECRET,
    providers: [
      {
        id: "oidc",
        name: env.AUTH_PROVIDER_NAME,
        type: "oauth",
        wellKnown: `${env.AUTH_ISSUER}/.well-known/openid-configuration`,
        authorization: { params: { scope: "openid email profile" } },
        idToken: true,
        checks: ["pkce", "state"] as const,
        profile(profile) {
          return {
            id: profile.sub as string,
            name: (profile.name ?? profile.email ?? profile.sub) as string,
            email: profile.email as string,
            image: (profile.picture ?? null) as string | null,
          };
        },
        clientId: env.AUTH_CLIENT_ID,
        clientSecret: env.AUTH_CLIENT_SECRET,
      },
    ],
    session: {
      strategy: "jwt",
      maxAge: 8 * 60 * 60, // 8 hours
    },
  };
}

export const authOptions = buildAuthOptions();

/**
 * Build a fresh `NextAuthOptions` from the current environment.
 * Intended for tests that need to re-evaluate config after changing env vars.
 * @internal
 */
export { buildAuthOptions as _buildAuthOptions };
