// DEPRECATED: Temporary shim — will be removed once all clients use SpacetimeDB directly.
import { NextResponse } from "next/server";
import { CreateWorkspaceSchema } from "@/lib/workspace/schemas";
import { createWorkspace, listWorkspaces } from "@/lib/workspace/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspaces = await listWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list workspaces";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = CreateWorkspaceSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid workspace payload" },
        { status: 400 },
      );
    }

    const workspace = await createWorkspace(parsed.data.name);
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
