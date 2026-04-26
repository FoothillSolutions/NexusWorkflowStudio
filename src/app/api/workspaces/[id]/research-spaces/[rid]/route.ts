import { NextResponse } from "next/server";
import { ResearchSpaceDataSchema, SaveResearchSpaceSchema, UpdateResearchSpaceMetaSchema } from "@/lib/research/schemas";
import { deleteResearchSpace, getResearchSpace, saveResearchSpace, updateResearchSpaceMeta } from "@/lib/research/server";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; rid: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id, rid } = await params;
    const space = await getResearchSpace(id, rid);
    if (!space) return NextResponse.json({ error: "Research space not found" }, { status: 404 });
    return NextResponse.json(space);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read research space";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id, rid } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = SaveResearchSpaceSchema.safeParse(body);
    const fallbackParsed = ResearchSpaceDataSchema.safeParse(body);
    if (!parsed.success && !fallbackParsed.success) {
      return NextResponse.json({ error: parsed.error?.issues[0]?.message ?? "Invalid save payload" }, { status: 400 });
    }
    const data = parsed.success ? parsed.data.data : fallbackParsed.success ? fallbackParsed.data : null;
    if (!data) {
      return NextResponse.json({ error: "Invalid save payload" }, { status: 400 });
    }
    const lastModifiedBy = parsed.success ? parsed.data.lastModifiedBy : "anonymous";
    const space = await saveResearchSpace(id, rid, data, lastModifiedBy);
    if (!space) return NextResponse.json({ error: "Research space not found" }, { status: 404 });
    return NextResponse.json({ saved: true, space });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save research space";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id, rid } = await params;
    const parsed = UpdateResearchSpaceMetaSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update payload" }, { status: 400 });
    }
    const space = await updateResearchSpaceMeta(id, rid, parsed.data);
    if (!space) return NextResponse.json({ error: "Research space not found" }, { status: 404 });
    return NextResponse.json({ space });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update research space";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id, rid } = await params;
    const deleted = await deleteResearchSpace(id, rid);
    if (!deleted) return NextResponse.json({ error: "Research space not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete research space";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
