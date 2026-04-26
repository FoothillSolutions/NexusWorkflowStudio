import { NextResponse } from "next/server";
import { parseEnrichResult, ResearchAiError } from "@/lib/research/ai";
import { ResearchBlockSchema } from "@/lib/research/schemas";
import { getResearchSpace } from "@/lib/research/server";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; rid: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id, rid } = await params;
    const space = await getResearchSpace(id, rid);
    if (!space) return NextResponse.json({ error: "Research space not found" }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const block = ResearchBlockSchema.safeParse(body.block);
    if (!block.success) return NextResponse.json({ error: "Invalid block" }, { status: 400 });
    if (typeof body.rawResult !== "string") {
      return NextResponse.json({ error: "AI not connected" }, { status: 503 });
    }
    const result = parseEnrichResult(body.rawResult, block.data.content);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enrich research";
    const status = error instanceof ResearchAiError ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
