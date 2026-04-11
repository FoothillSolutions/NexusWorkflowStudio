import { NextResponse } from "next/server";
import { computeChanges } from "@/lib/workspace/snapshots";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const since = url.searchParams.get("since");

    if (!since) {
      return NextResponse.json({ error: "Missing required 'since' query parameter" }, { status: 400 });
    }

    // Validate ISO timestamp
    const parsed = Date.parse(since);
    if (isNaN(parsed)) {
      return NextResponse.json({ error: "Invalid 'since' timestamp — must be ISO 8601" }, { status: 400 });
    }

    const result = await computeChanges(id, since);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute changes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
