"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GitFork, Plus, Search, Trash2 } from "lucide-react";
import type { PackRecord } from "@/lib/library-store/types";

interface PackBrowserProps {
  packs: PackRecord[];
  selectedPackId: string | null;
  onSelectPack: (packId: string) => void;
  onCreatePack: (packKey: string, name: string) => Promise<void>;
  onForkPack: (packId: string) => Promise<void>;
  onDeletePack: (packId: string) => Promise<void>;
}

export function PackBrowser({ packs, selectedPackId, onSelectPack, onCreatePack, onForkPack, onDeletePack }: PackBrowserProps) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newPackKey, setNewPackKey] = useState("");
  const [newPackName, setNewPackName] = useState("");

  const filtered = packs.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.packKey.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input
            placeholder="Search packs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-7 bg-zinc-900 border-zinc-800 h-8 text-sm"
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => setCreating((c) => !c)} className="h-8">
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>
      {creating && (
        <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
          <Input
            placeholder="pack-key (kebab-case)"
            value={newPackKey}
            onChange={(e) => setNewPackKey(e.target.value)}
            className="bg-zinc-900 border-zinc-800 h-7 text-xs font-mono"
          />
          <Input
            placeholder="Pack name"
            value={newPackName}
            onChange={(e) => setNewPackName(e.target.value)}
            className="bg-zinc-900 border-zinc-800 h-7 text-xs"
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              className="h-7 text-xs flex-1"
              disabled={!newPackKey || !newPackName}
              onClick={async () => {
                await onCreatePack(newPackKey, newPackName);
                setNewPackKey("");
                setNewPackName("");
                setCreating(false);
              }}
            >
              Create
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <ul className="space-y-1">
        {filtered.length === 0 ? (
          <li className="text-xs text-zinc-600 italic px-2">No packs in this library.</li>
        ) : (
          filtered.map((pack) => (
            <li key={pack.id}>
              <div
                className={`group rounded-md border px-2 py-1.5 cursor-pointer transition-colors ${selectedPackId === pack.id ? "border-cyan-700 bg-cyan-950/40" : "border-zinc-800 bg-zinc-950/30 hover:bg-zinc-900/40"}`}
                onClick={() => onSelectPack(pack.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-100 truncate">{pack.name}</div>
                    <div className="text-[10px] font-mono text-zinc-500 truncate">{pack.packKey}</div>
                    {pack.basePackId && (
                      <Badge variant="outline" className="mt-1 text-[10px] text-violet-300">
                        forked
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                    {!pack.basePackId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void onForkPack(pack.id);
                        }}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300"
                        title="Fork to user library"
                      >
                        <GitFork className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDeletePack(pack.id);
                      }}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400"
                      title="Soft-delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
