import { NextResponse } from "next/server";
import { getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";
import { getLibraryStore } from "@/lib/library-store/store";
import { forkPackSchema } from "@/lib/library-store/schemas";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ packId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const workspaceId = await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { packId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = forkPackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }
    const store = getLibraryStore();
    const { workspace, user } = await store.ensureLibraries(workspaceId, parsed.data.targetScope === "user" ? "default-user" : null);
    const lib = parsed.data.targetScope === "user" ? user : workspace;
    if (!lib) return NextResponse.json({ error: "Target library unavailable" }, { status: 400 });
    const pack = await store.forkPack(packId, lib.id, { packKey: parsed.data.packKey });
    return NextResponse.json({ pack });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
