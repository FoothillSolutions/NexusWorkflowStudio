import { NextResponse } from "next/server";
import { getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";
import { getLibraryStore } from "@/lib/library-store/store";
import { updatePackSchema } from "@/lib/library-store/schemas";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ packId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { packId } = await context.params;
    const url = new URL(request.url);
    const validate = url.searchParams.get("validate");
    const store = getLibraryStore();
    const pack = await store.getPack(packId);
    if (validate === "1" && pack) {
      const warnings = await store.validatePackById(packId);
      return NextResponse.json({ pack, warnings });
    }
    return NextResponse.json({ pack });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { packId } = await context.params;
    const body = await request.json();
    const parsed = updatePackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }
    const store = getLibraryStore();
    const pack = await store.renamePack(packId, parsed.data);
    return NextResponse.json({ pack });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { packId } = await context.params;
    await getLibraryStore().softDeletePack(packId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
