// DEPRECATED: Temporary shim — will be removed once all clients use SpacetimeDB directly.
import { NextResponse } from "next/server";
import { SaveWorkflowSchema, UpdateWorkflowMetaSchema } from "@/lib/workspace/schemas";
import {
  getWorkflow,
  saveWorkflow,
  updateWorkflowMeta,
  deleteWorkflow,
} from "@/lib/workspace/server";
import type { WorkflowJSON } from "@/types/workflow";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; wid: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id, wid } = await params;
    const data = await getWorkflow(id, wid);
    if (!data) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read workflow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id, wid } = await params;
    const parsed = SaveWorkflowSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid save payload" },
        { status: 400 },
      );
    }

    const saved = await saveWorkflow(
      id,
      wid,
      parsed.data.data as unknown as WorkflowJSON,
      parsed.data.lastModifiedBy,
    );
    if (!saved) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }
    return NextResponse.json({ saved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save workflow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id, wid } = await params;
    const parsed = UpdateWorkflowMetaSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid update payload" },
        { status: 400 },
      );
    }

    const record = await updateWorkflowMeta(id, wid, parsed.data);
    if (!record) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }
    return NextResponse.json({ workflow: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update workflow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id, wid } = await params;
    const deleted = await deleteWorkflow(id, wid);
    if (!deleted) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete workflow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
