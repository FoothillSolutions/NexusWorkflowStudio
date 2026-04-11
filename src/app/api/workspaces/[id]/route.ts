import { NextResponse } from "next/server";
import { UpdateWorkspaceSchema } from "@/lib/workspace/schemas";
import { deleteWorkspace, getWorkspace, updateWorkspace } from "@/lib/workspace/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const manifest = await getWorkspace(id);
    if (!manifest) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    return NextResponse.json(manifest);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const parsed = UpdateWorkspaceSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid update payload" },
        { status: 400 },
      );
    }

    const workspace = await updateWorkspace(id, parsed.data);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    return NextResponse.json({ workspace });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteWorkspace(id);
    if (!deleted) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
