"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PackVersionRecord } from "@/lib/library-store/types";

interface PublishPanelProps {
  packVersions: PackVersionRecord[];
  onPublishPack: (version: string, notes: string) => void;
}

export function PublishPanel({ packVersions, onPublishPack }: PublishPanelProps) {
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Publish Pack</div>
      <div>
        <Label htmlFor="pack-version" className="text-xs text-zinc-400">Version (semver)</Label>
        <Input
          id="pack-version"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="1.0.0"
          className="bg-zinc-900 border-zinc-800 mt-1"
        />
      </div>
      <div>
        <Label htmlFor="pack-notes" className="text-xs text-zinc-400">Notes</Label>
        <Input
          id="pack-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="bg-zinc-900 border-zinc-800 mt-1"
        />
      </div>
      <Button
        size="sm"
        onClick={() => {
          onPublishPack(version, notes);
          setVersion("");
          setNotes("");
        }}
        disabled={!version}
      >
        Publish version
      </Button>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">Published versions</div>
        {packVersions.length === 0 ? (
          <p className="text-xs text-zinc-600 italic">No published versions.</p>
        ) : (
          <ul className="space-y-1">
            {packVersions.map((pv) => (
              <li key={pv.id} className="text-xs font-mono text-zinc-300">
                {pv.version} <span className="text-zinc-500">{new Date(pv.createdAt).toLocaleString()}</span>
                {pv.deprecated && <span className="ml-2 text-amber-400">deprecated</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
