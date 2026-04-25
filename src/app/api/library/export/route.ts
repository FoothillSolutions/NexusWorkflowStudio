import { getBrainTokenFromHeaders, requireWorkspace } from "@/lib/brain/server";
import { buildNexusArchive } from "@/lib/library-store/export";
import { exportRequestSchema } from "@/lib/library-store/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireWorkspace(getBrainTokenFromHeaders(request.headers));
    const body = await request.json();
    const parsed = exportRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const { buffer, archiveName } = await buildNexusArchive({
      workflowJson: parsed.data.workflowJson,
      workflowName: parsed.data.workflowName,
      createdBy: parsed.data.createdBy,
    });
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${archiveName}"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
