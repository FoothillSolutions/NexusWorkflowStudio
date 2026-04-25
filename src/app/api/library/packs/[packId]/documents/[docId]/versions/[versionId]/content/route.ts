import { NextResponse } from "next/server";
import { getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";
import { getLibraryStore } from "@/lib/library-store/store";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ packId: string; docId: string; versionId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { docId, versionId } = await context.params;
    const content = await getLibraryStore().readDocumentContent(docId, versionId);
    if (content === null) return NextResponse.json({ error: "Version not found" }, { status: 404 });
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
