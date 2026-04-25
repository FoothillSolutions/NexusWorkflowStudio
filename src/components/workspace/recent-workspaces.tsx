"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Workflow } from "lucide-react";
import { getRecentWorkspaces } from "@/lib/workspace/local-history";
import { TEXT_MUTED, TEXT_SECONDARY, BORDER_DEFAULT } from "@/lib/theme";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecentWorkspaces() {
  const router = useRouter();
  const [entries] = useState(() => getRecentWorkspaces());

  if (entries.length === 0) return null;

  return (
    <div className="w-full max-w-xl space-y-3">
      <h2 className={`text-sm font-medium ${TEXT_MUTED}`}>Recent workspaces</h2>
      <div className="space-y-1.5">
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => router.push(`/workspace/${entry.id}`)}
            className={`flex w-full items-center gap-3 rounded-lg border ${BORDER_DEFAULT} bg-zinc-900/60 px-4 py-3 text-left transition-colors hover:bg-zinc-800/80`}
          >
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-medium ${TEXT_SECONDARY}`}>
                {entry.name}
              </p>
              <div className={`mt-0.5 flex items-center gap-3 text-xs ${TEXT_MUTED}`}>
                <span className="flex items-center gap-1">
                  <Workflow className="h-3 w-3" />
                  {entry.workflowCount} {entry.workflowCount === 1 ? "workflow" : "workflows"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeAgo(entry.lastAccessedAt)}
                </span>
              </div>
            </div>

            {entry.memberNames.length > 0 && (
              <div className="flex -space-x-1.5">
                {entry.memberNames.slice(0, 3).map((name) => (
                  <div
                    key={name}
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-zinc-900 bg-zinc-700 text-[9px] font-semibold text-zinc-300"
                  >
                    {name.slice(0, 2)}
                  </div>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
