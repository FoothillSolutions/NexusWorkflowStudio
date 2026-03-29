"use client";

export function HeaderBrand() {
  return (
    <div className="flex min-w-0 items-center pr-1">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-zinc-200">
            Nexus
            <span className="hidden font-medium text-zinc-500 sm:inline"> Workflow Studio</span>
          </span>
        </div>
      </div>
    </div>
  );
}

