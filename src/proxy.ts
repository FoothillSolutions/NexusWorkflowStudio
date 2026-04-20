import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthEnabled } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  if (!isAuthEnabled()) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (token) return NextResponse.next();

  // API routes: return 401 instead of an HTML redirect
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Page routes: redirect to sign-in, preserving the original URL
  const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    // Match all paths except:
    //  - /api/auth/* (NextAuth endpoints)
    //  - /_next/static/* and /_next/image/* (static assets)
    //  - /favicon.ico
    //  - /livez (health check)
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|livez).*)",
  ],
};
