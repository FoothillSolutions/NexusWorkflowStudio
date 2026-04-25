import { NextResponse } from "next/server";
import { restoreBrainVersionSchema } from "@/lib/brain/schemas";
import { getBrainStore, getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const workspaceId = await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { id } = await params;
    const parsed = restoreBrainVersionSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid restore payload" },
        { status: 400 },
      );
    }

    const doc = await getBrainStore().restoreVersion(workspaceId, id, parsed.data.versionId);
    if (!doc) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    return NextResponse.json({ doc });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to restore version";
    const status = message.includes("token") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
