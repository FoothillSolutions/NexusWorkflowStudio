import { NextResponse } from "next/server";
import { getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";
import { getLibraryStore } from "@/lib/library-store/store";
import { updateDocumentSchema } from "@/lib/library-store/schemas";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ packId: string; docId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { packId, docId } = await context.params;
    const documents = await getLibraryStore().listDocuments(packId, { includeDeleted: true });
    const document = documents.find((d) => d.id === docId);
    if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    const content = await getLibraryStore().readDocumentContent(docId, document.currentVersionId);
    return NextResponse.json({ document, content });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { docId } = await context.params;
    const body = await request.json();
    const parsed = updateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }
    const store = getLibraryStore();
    let document = await store.listDocuments((await store.readManifest()).documents.find((d) => d.id === docId)?.packId ?? "");
    document = document.filter((d) => d.id === docId);
    let updated = document[0];
    if (parsed.data.path) {
      updated = await store.renameDocument(docId, parsed.data.path);
    }
    return NextResponse.json({ document: updated });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { docId } = await context.params;
    await getLibraryStore().softDeleteDocument(docId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
