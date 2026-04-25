import { NextResponse } from "next/server";
import { getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";
import { importNexusArchive, importAgentSkillsFolder } from "@/lib/library-store/import";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const workspaceId = await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file upload" }, { status: 400 });
    }
    const format = (formData.get("format") as string | null) ?? "nexus";
    const scope = (formData.get("scope") as "workspace" | "user" | null) ?? "workspace";
    const buffer = Buffer.from(await file.arrayBuffer());

    if (format === "agent-skills") {
      const packKey = (formData.get("packKey") as string | null) ?? "imported-skills";
      const result = await importAgentSkillsFolder({
        buffer,
        workspaceId,
        ownerUserId: scope === "user" ? "default-user" : null,
        scope,
        packKey,
      });
      return NextResponse.json({ packs: result.packs });
    }

    const result = await importNexusArchive({
      buffer,
      workspaceId,
      ownerUserId: scope === "user" ? "default-user" : null,
      scope,
    });
    return NextResponse.json({ packs: result.packs });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
