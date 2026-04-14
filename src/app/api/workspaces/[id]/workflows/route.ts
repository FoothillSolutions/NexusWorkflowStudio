import { NextResponse } from "next/server";
import { CreateWorkflowSchema } from "@/lib/workspace/schemas";
import { createWorkflow } from "@/lib/workspace/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const parsed = CreateWorkflowSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid workflow payload" },
        { status: 400 },
      );
    }

    const workflow = await createWorkflow(id, parsed.data.name);
    if (!workflow) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create workflow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
