"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAwarenessStore } from "@/store/collaboration";
import { useCollabStore } from "@/store/collaboration";
import { isPeerActive, useIdleTicker } from "./peer-activity";

const MAX_VISIBLE = 4;

export function PresenceAvatars() {
  const peers = useAwarenessStore((s) => s.peers);
  const isConnected = useCollabStore((s) => s.isConnected);

  // Re-render periodically so idle state flips without an awareness update.
  useIdleTicker();

  if (!isConnected || peers.length === 0) return null;

  const visible = peers.slice(0, MAX_VISIBLE);
  const overflow = peers.length - MAX_VISIBLE;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((peer) => {
        const active = isPeerActive(peer.lastActiveAt);
        return (
          <Tooltip key={peer.clientId}>
            <TooltipTrigger asChild>
              <div
                className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-zinc-900 text-[10px] font-semibold text-white select-none cursor-default transition-opacity"
                style={{ backgroundColor: peer.user.color, opacity: active ? 1 : 0.45 }}
                aria-label={peer.user.name}
              >
                {peer.user.name.slice(0, 2)}
                <span
                  aria-hidden="true"
                  className={`absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-zinc-900 ${
                    active ? "bg-emerald-500" : "bg-zinc-500"
                  }`}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                {peer.user.name}
                {!active && <span className="ml-1.5 text-zinc-400">· idle</span>}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}

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
