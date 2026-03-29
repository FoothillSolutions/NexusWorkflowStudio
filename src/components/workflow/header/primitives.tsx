"use client";

import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

interface ActionRailProps extends PropsWithChildren {
  className?: string;
}

export function ActionRail({ className, children }: ActionRailProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-xl border border-zinc-700/50 bg-zinc-900/80 p-1 shadow-lg backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

