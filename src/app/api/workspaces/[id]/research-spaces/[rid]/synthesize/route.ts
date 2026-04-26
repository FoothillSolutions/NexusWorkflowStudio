import { NextResponse } from "next/server";
import { synthesizeResearch } from "@/lib/research/ai";
import { getResearchSpace, saveResearchSpace } from "@/lib/research/server";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; rid: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id, rid } = await params;
    const space = await getResearchSpace(id, rid);
    if (!space) return NextResponse.json({ error: "Research space not found" }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const selectedIds = Array.isArray(body.blockIds) ? new Set<string>(body.blockIds) : null;
    const blocks = selectedIds ? space.blocks.filter((block) => selectedIds.has(block.id)) : space.blocks;
    const synthesis = synthesizeResearch(blocks, body.title ?? "Research Synthesis", body.createdBy ?? "research");
    const saved = await saveResearchSpace(id, rid, { ...space, syntheses: [synthesis, ...space.syntheses] }, body.createdBy ?? "research");
    return NextResponse.json({ synthesis, space: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to synthesize research";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
