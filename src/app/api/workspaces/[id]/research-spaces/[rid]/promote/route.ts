import { NextResponse } from "next/server";
import { getBrainStore } from "@/lib/brain/server";
import { PromoteResearchSchema } from "@/lib/research/schemas";
import { getResearchSpace } from "@/lib/research/server";
import { buildResearchPromotionDoc } from "@/lib/research/promotion";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; rid: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id, rid } = await params;
    const parsed = PromoteResearchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid promote payload" }, { status: 400 });
    }
    const space = await getResearchSpace(id, rid);
    if (!space) return NextResponse.json({ error: "Research space not found" }, { status: 404 });

    const targetWorkspaceId = parsed.data.target === "personal"
      ? request.headers.get("x-brain-workspace-id") ?? id
      : id;
    const doc = await getBrainStore().saveDoc(targetWorkspaceId, buildResearchPromotionDoc(space, parsed.data));
    return NextResponse.json({ doc, target: parsed.data.target });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to promote research";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
