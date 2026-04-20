export { auth as middleware } from "@/lib/auth";

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
