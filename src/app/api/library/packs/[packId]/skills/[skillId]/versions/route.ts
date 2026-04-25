import { NextResponse } from "next/server";
import { getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";
import { getLibraryStore } from "@/lib/library-store/store";
import { publishSkillSchema } from "@/lib/library-store/schemas";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ packId: string; skillId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { skillId } = await context.params;
    const versions = await getLibraryStore().listSkillVersions(skillId);
    return NextResponse.json({ versions });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { skillId } = await context.params;
    const body = await request.json();
    const parsed = publishSkillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }
    const skillVersion = await getLibraryStore().publishSkillVersion(skillId, parsed.data);
    return NextResponse.json({ skillVersion });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
