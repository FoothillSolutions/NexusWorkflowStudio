import { NextResponse } from "next/server";
import { getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";
import { getLibraryStore } from "@/lib/library-store/store";
import { resolveLiveSchema } from "@/lib/library-store/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const body = await request.json();
    const parsed = resolveLiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }
    const bundle = await getLibraryStore().resolveLive(parsed.data);
    return NextResponse.json({ bundle });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
