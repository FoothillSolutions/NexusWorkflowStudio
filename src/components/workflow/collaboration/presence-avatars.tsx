"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAwarenessStore } from "@/store/collaboration";
import { useCollabStore } from "@/store/collaboration";

const MAX_VISIBLE = 4;

export function PresenceAvatars() {
  const peers = useAwarenessStore((s) => s.peers);
  const isConnected = useCollabStore((s) => s.isConnected);

  if (!isConnected || peers.length === 0) return null;

  const visible = peers.slice(0, MAX_VISIBLE);
  const overflow = peers.length - MAX_VISIBLE;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((peer) => (
        <Tooltip key={peer.clientId}>
          <TooltipTrigger asChild>
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-zinc-900 text-[10px] font-semibold text-white select-none cursor-default"
              style={{ backgroundColor: peer.user.color }}
              aria-label={peer.user.name}
            >
              {peer.user.name.slice(0, 2)}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{peer.user.name}</p>
          </TooltipContent>
        </Tooltip>
      ))}

      {overflow > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-zinc-900 bg-zinc-700 text-[10px] font-semibold text-zinc-300 select-none cursor-default">
              +{overflow}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{overflow} more {overflow === 1 ? "person" : "people"}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
