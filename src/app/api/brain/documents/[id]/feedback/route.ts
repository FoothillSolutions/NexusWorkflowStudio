import { NextResponse } from "next/server";
import { addBrainFeedbackSchema } from "@/lib/brain/schemas";
import { getBrainStore, getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const workspaceId = await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const { id } = await params;
    const parsed = addBrainFeedbackSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid feedback payload" },
        { status: 400 },
      );
    }

    const doc = await getBrainStore().addFeedback(workspaceId, id, parsed.data.feedback);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ doc });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add feedback";
    const status = message.includes("token") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
