import { NextResponse } from "next/server";
import { sessionRequestSchema } from "@/lib/library-store/schemas";
import { getBrainStore, getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";
import { getLibraryStore } from "@/lib/library-store/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = sessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const headerToken = getBrainTokenFromHeaders(request.headers);
  const token = parsed.data.token ?? headerToken ?? null;
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspace(token);
  } catch {
    const session = await getBrainStore().createOrResumeSession(null, null);
    workspaceId = session.workspaceId;
  }

  const store = getLibraryStore();
  await store.ensureLibraries(workspaceId, parsed.data.ownerUserId ?? null);
  const libraries = await store.listLibraries(workspaceId);
  return NextResponse.json({
    workspaceId,
    ownerUserId: parsed.data.ownerUserId ?? null,
    libraries,
  });
}
