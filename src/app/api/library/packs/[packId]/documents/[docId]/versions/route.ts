import { NextResponse } from "next/server";
import { getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";
import { getLibraryStore, StaleVersionError } from "@/lib/library-store/store";
import { saveDocumentVersionSchema } from "@/lib/library-store/schemas";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ packId: string; docId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { docId } = await context.params;
    const versions = await getLibraryStore().listVersions(docId);
    return NextResponse.json({ versions });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { docId } = await context.params;
    const body = await request.json();
    const parsed = saveDocumentVersionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }
    const ifMatch = request.headers.get("If-Match");
    const previousVersionId = ifMatch ?? parsed.data.previousVersionId;
    const version = await getLibraryStore().saveDocumentVersion(docId, {
      content: parsed.data.content,
      previousVersionId,
      message: parsed.data.message,
      createdBy: parsed.data.createdBy,
      metadata: parsed.data.metadata,
    });
    return NextResponse.json({ version });
  } catch (error) {
    if (error instanceof StaleVersionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
