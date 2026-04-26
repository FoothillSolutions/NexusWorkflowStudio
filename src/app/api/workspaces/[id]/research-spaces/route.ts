import { NextResponse } from "next/server";
import { CreateResearchSpaceSchema } from "@/lib/research/schemas";
import { createResearchSpace, listResearchSpaces } from "@/lib/research/server";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const spaces = await listResearchSpaces(id);
    if (!spaces) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    return NextResponse.json({ spaces });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list research spaces";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const parsed = CreateResearchSpaceSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid research space payload" }, { status: 400 });
    }
    const space = await createResearchSpace(id, parsed.data);
    if (!space) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    return NextResponse.json({ space }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create research space";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
