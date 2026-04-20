import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { isAuthEnabled, getAuthEnv } from "./env";

const PLACEHOLDER_SECRET = "nexus-auth-disabled-no-secret-required";

function buildConfig(): NextAuthConfig {
  if (!isAuthEnabled()) {
    return {
      secret: PLACEHOLDER_SECRET,
      providers: [],
      callbacks: {
        authorized: () => true,
      },
    };
  }

  const env = getAuthEnv();

  return {
    secret: env.AUTH_SECRET,
    trustHost: true,
    providers: [
      {
        id: "oidc",
        name: env.AUTH_PROVIDER_NAME,
        type: "oidc",
        issuer: env.AUTH_ISSUER,
        clientId: env.AUTH_CLIENT_ID,
        clientSecret: env.AUTH_CLIENT_SECRET,
      },
    ],
    session: {
      strategy: "jwt",
      maxAge: 8 * 60 * 60, // 8 hours
    },
    callbacks: {
      authorized({ auth }) {
        return !!auth?.user;
      },
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(buildConfig());
