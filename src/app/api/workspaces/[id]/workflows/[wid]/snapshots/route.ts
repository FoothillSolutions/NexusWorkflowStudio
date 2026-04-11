// DEPRECATED: Temporary shim — will be removed once all clients use SpacetimeDB directly.
import { NextResponse } from "next/server";
import { listSnapshots } from "@/lib/workspace/snapshots";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; wid: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id, wid } = await params;
    const metas = await listSnapshots(id, wid);
    return NextResponse.json(metas);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list snapshots";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
