import { NextResponse } from "next/server";
import {
  createShareToken,
  getBrainTokenFromHeaders,
  requireWorkspace,
} from "@/lib/brain/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const workspaceId = await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const token = createShareToken(workspaceId);
    return NextResponse.json({ token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create share token";
    const status = message.includes("token") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
