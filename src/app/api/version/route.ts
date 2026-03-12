import { NextResponse } from "next/server";
import { CURRENT_VERSION } from "@/lib/changelog";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    appVersion: CURRENT_VERSION,
    gitSha: process.env.APP_GIT_SHA ?? "unknown",
    buildTimestamp: process.env.APP_BUILD_TIMESTAMP ?? "unknown",
    nodeEnv: process.env.NODE_ENV ?? "unknown",
  });
}