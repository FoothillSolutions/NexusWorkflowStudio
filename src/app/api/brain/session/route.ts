// DEPRECATED: Temporary shim — will be removed once all clients use SpacetimeDB directly.
import { NextResponse } from "next/server";
import { brainSessionRequestSchema } from "@/lib/brain/schemas";
import { getBrainStore } from "@/lib/brain/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = brainSessionRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid session payload" },
      { status: 400 },
    );
  }

  const session = await getBrainStore().createOrResumeSession(
    parsed.data.token ?? null,
    parsed.data.legacyBrain ?? null,
  );

  return NextResponse.json(session);
}
