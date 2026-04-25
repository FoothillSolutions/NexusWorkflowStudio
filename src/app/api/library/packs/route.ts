import { NextResponse } from "next/server";
import { getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";
import { getLibraryStore } from "@/lib/library-store/store";
import { createPackSchema, libraryScopeSchema } from "@/lib/library-store/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const workspaceId = await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const url = new URL(request.url);
    const scopeParam = url.searchParams.get("scope");
    const scope = scopeParam ? libraryScopeSchema.parse(scopeParam) : "workspace";
    const store = getLibraryStore();
    const { workspace, user } = await store.ensureLibraries(workspaceId, scope === "user" ? "default-user" : null);
    const lib = scope === "user" ? user : workspace;
    if (!lib) return NextResponse.json({ packs: [] });
    const packs = await store.listPacks(lib.id);
    return NextResponse.json({ packs });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const body = await request.json();
    const parsed = createPackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }
    const store = getLibraryStore();
    const { workspace, user } = await store.ensureLibraries(workspaceId, parsed.data.scope === "user" ? "default-user" : null);
    const lib = parsed.data.scope === "user" ? user : workspace;
    if (!lib) return NextResponse.json({ error: "Library not available" }, { status: 400 });
    const pack = await store.createPack(lib.id, {
      packKey: parsed.data.packKey,
      name: parsed.data.name,
      description: parsed.data.description,
      tags: parsed.data.tags,
      createdBy: parsed.data.createdBy,
      metadata: parsed.data.metadata,
    });
    return NextResponse.json({ pack });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
