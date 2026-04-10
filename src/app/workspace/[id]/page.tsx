"use client";

import { use } from "react";
import { WorkspaceDashboard } from "@/components/workspace/dashboard";

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <WorkspaceDashboard workspaceId={id} />;
}
