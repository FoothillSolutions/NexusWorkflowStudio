import { NextResponse } from "next/server";
import { getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";
import { getLibraryStore, ValidationError } from "@/lib/library-store/store";
import { publishPackSchema } from "@/lib/library-store/schemas";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ packId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { packId } = await context.params;
    const versions = await getLibraryStore().listPackVersions(packId);
    return NextResponse.json({ versions });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { packId } = await context.params;
    const body = await request.json();
    const parsed = publishPackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }
    const packVersion = await getLibraryStore().publishPackVersion(packId, parsed.data);
    return NextResponse.json({ packVersion });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, warnings: error.warnings }, { status: 400 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
