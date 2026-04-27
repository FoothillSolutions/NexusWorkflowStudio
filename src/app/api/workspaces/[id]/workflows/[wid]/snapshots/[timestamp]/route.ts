import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/workspace/snapshots";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; wid: string; timestamp: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id, wid, timestamp } = await params;
    // Decode URL-safe timestamp back to ISO
    const tIndex = timestamp.indexOf("T");
    let isoTimestamp = timestamp;
    if (tIndex >= 0) {
      const datePart = timestamp.slice(0, tIndex);
      const timePart = timestamp.slice(tIndex).replace(/-/g, ":");
      isoTimestamp = datePart + timePart;
    }

    const snapshot = await getSnapshot(id, wid, isoTimestamp);
    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read snapshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
