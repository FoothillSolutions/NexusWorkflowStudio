import { ResearchPage } from "@/components/research/research-page";

export const dynamic = "force-dynamic";

export default async function WorkspaceResearchRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResearchPage workspaceId={id} />;
}
