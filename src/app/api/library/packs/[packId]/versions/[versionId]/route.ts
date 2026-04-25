import { NextResponse } from "next/server";
import { getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";
import { getLibraryStore } from "@/lib/library-store/store";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ packId: string; versionId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { packId, versionId } = await context.params;
    const versions = await getLibraryStore().listPackVersions(packId);
    const packVersion = versions.find((v) => v.id === versionId);
    if (!packVersion) return NextResponse.json({ error: "Pack version not found" }, { status: 404 });
    const manifest = await getLibraryStore().getObjectStorage().getObjectAsString(packVersion.manifestKey);
    return NextResponse.json({ packVersion, manifest: manifest ? JSON.parse(manifest) : null });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
