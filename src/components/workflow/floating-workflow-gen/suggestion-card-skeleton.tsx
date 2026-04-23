"use client";

interface SuggestionCardSkeletonProps {
  index?: number;
}

export function SuggestionCardSkeleton({ index = 0 }: SuggestionCardSkeletonProps) {
  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3">
      <div className="flex flex-col gap-2">
        <div
          className="h-3 rounded-md bg-linear-to-r from-zinc-800/60 via-zinc-700/30 to-zinc-800/60 animate-shimmer"
          style={{ width: `${70 - index * 5}%`, backgroundSize: "200% 100%" }}
        />
        <div
          className="h-2.5 rounded-md bg-linear-to-r from-zinc-800/60 via-zinc-700/30 to-zinc-800/60 animate-shimmer"
          style={{
            width: `${92 - index * 4}%`,
            backgroundSize: "200% 100%",
            animationDelay: `${0.15 * (index + 1)}s`,
          }}
        />
        <div
          className="h-2.5 rounded-md bg-linear-to-r from-zinc-800/60 via-zinc-700/30 to-zinc-800/60 animate-shimmer"
          style={{
            width: `${80 - index * 4}%`,
            backgroundSize: "200% 100%",
            animationDelay: `${0.3 * (index + 1)}s`,
          }}
        />
      </div>
    </div>
  );
}
