import { NextResponse } from "next/server";
import { getBrainStore, getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const workspaceId = await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { id } = await params;
    const deleted = await getBrainStore().deleteDoc(workspaceId, id);
    if (!deleted) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete document";
    const status = message.includes("token") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
