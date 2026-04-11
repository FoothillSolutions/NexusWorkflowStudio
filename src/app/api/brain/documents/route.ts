// DEPRECATED: Temporary shim — will be removed once all clients use SpacetimeDB directly.
import { NextResponse } from "next/server";
import { saveBrainDocInputSchema } from "@/lib/brain/schemas";
import { getBrainStore, getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const workspaceId = await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const docs = await getBrainStore().listDocs(workspaceId);
    return NextResponse.json({ docs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const parsed = saveBrainDocInputSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid document payload" },
        { status: 400 },
      );
    }

    const doc = await getBrainStore().saveDoc(workspaceId, parsed.data);
    return NextResponse.json({ doc });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save document";
    const status = message.includes("token") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
