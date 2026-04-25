"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLibraryDocsStore } from "@/store/library-docs";
import type { LibraryScope, SkillRef } from "@/types/library";
import type { PackRecord, SkillRecord } from "@/lib/library-store/types";

interface SkillPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (ref: SkillRef & { packKey?: string; skillKey?: string; skillName?: string }) => void;
  currentRef?: SkillRef | null;
}

export function SkillPickerDialog({ open, onOpenChange, onSelect, currentRef }: SkillPickerDialogProps) {
  const {
    bootstrap,
    bootstrapped,
    workspacePacks,
    userPacks,
    skills,
    packVersions,
    loadPackDetail,
  } = useLibraryDocsStore();

  const [activeScope, setActiveScope] = useState<LibraryScope>(currentRef?.scope ?? "workspace");
  const [selectedPack, setSelectedPack] = useState<PackRecord | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillRecord | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>("draft");

  useEffect(() => {
    if (open && !bootstrapped) {
      void bootstrap();
    }
  }, [open, bootstrapped, bootstrap]);

  useEffect(() => {
    if (selectedPack) {
      void loadPackDetail(selectedPack.id);
    }
  }, [selectedPack, loadPackDetail]);

  const packs = activeScope === "workspace" ? workspacePacks : userPacks;
  const currentPackSkills = useMemo(() => (selectedPack ? skills[selectedPack.id] ?? [] : []), [selectedPack, skills]);
  const currentPackVersions = useMemo(() => (selectedPack ? packVersions[selectedPack.id] ?? [] : []), [selectedPack, packVersions]);

  const handleConfirm = () => {
    if (!selectedPack || !selectedSkill) return;
    onSelect({
      scope: activeScope,
      packId: selectedPack.id,
      packKey: selectedPack.packKey,
      packVersion: selectedVersion,
      skillId: selectedSkill.id,
      skillKey: selectedSkill.skillKey,
      skillName: selectedSkill.name,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link Library Skill</DialogTitle>
        </DialogHeader>
        <Tabs value={activeScope} onValueChange={(v) => setActiveScope(v as LibraryScope)}>
          <TabsList>
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
            <TabsTrigger value="user">User-local</TabsTrigger>
          </TabsList>
          <TabsContent value={activeScope} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-zinc-400 mb-1.5">Pack</Label>
                <ScrollArea className="h-64 rounded-md border border-zinc-800 bg-zinc-950/40">
                  <div className="p-1">
                    {packs.length === 0 && (
                      <p className="p-3 text-xs text-zinc-500">No packs in {activeScope} library.</p>
                    )}
                    {packs.map((pack) => (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => {
                          setSelectedPack(pack);
                          setSelectedSkill(null);
                          setSelectedVersion("draft");
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-800/50 ${selectedPack?.id === pack.id ? "bg-zinc-800/80 text-zinc-100" : "text-zinc-300"}`}
                      >
                        <div className="font-medium">{pack.name}</div>
                        <div className="text-xs text-zinc-500 font-mono">{pack.packKey}</div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <div>
                <Label className="text-xs text-zinc-400 mb-1.5">Skill</Label>
                <ScrollArea className="h-64 rounded-md border border-zinc-800 bg-zinc-950/40">
                  <div className="p-1">
                    {!selectedPack && (
                      <p className="p-3 text-xs text-zinc-500">Select a pack.</p>
                    )}
                    {selectedPack && currentPackSkills.length === 0 && (
                      <p className="p-3 text-xs text-zinc-500">No skills in this pack.</p>
                    )}
                    {currentPackSkills.map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => setSelectedSkill(skill)}
                        className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-800/50 ${selectedSkill?.id === skill.id ? "bg-zinc-800/80 text-zinc-100" : "text-zinc-300"} ${skill.deprecated ? "opacity-60" : ""}`}
                      >
                        <div className="font-medium">{skill.name}{skill.deprecated && " (deprecated)"}</div>
                        <div className="text-xs text-zinc-500 font-mono">{skill.skillKey}</div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <div>
              <Label htmlFor="version-select" className="text-xs text-zinc-400 mb-1.5">Version</Label>
              <select
                id="version-select"
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
                disabled={!selectedSkill}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1.5 text-sm"
              >
                <option value="draft">draft (live)</option>
                {currentPackVersions.map((pv) => (
                  <option key={pv.id} value={pv.version}>{pv.version}{pv.deprecated ? " (deprecated)" : ""}</option>
                ))}
              </select>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!selectedSkill} onClick={handleConfirm}>Link Skill</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface InlineSkillRefDisplayProps {
  skillRef: SkillRef & { packKey?: string; skillKey?: string; skillName?: string };
  onDetach: () => void;
}

export function InlineSkillRefDisplay({ skillRef, onDetach }: InlineSkillRefDisplayProps) {
  return (
    <div className="space-y-2 rounded-md border border-cyan-800/40 bg-cyan-950/20 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-cyan-200">Library reference</div>
        <Button size="sm" variant="ghost" className="text-xs" onClick={onDetach}>Detach</Button>
      </div>
      <div className="text-xs font-mono text-zinc-300 space-y-0.5">
        <div>scope: {skillRef.scope}</div>
        <div>pack: {skillRef.packKey ?? skillRef.packId}</div>
        <div>version: {skillRef.packVersion}</div>
        <div>skill: {skillRef.skillName ?? skillRef.skillKey ?? skillRef.skillId}</div>
      </div>
    </div>
  );
}

interface LibraryRefSectionProps {
  value: SkillRef | null;
  onChange: (value: SkillRef | null) => void;
}

export function LibraryRefSection({ value, onChange }: LibraryRefSectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <Label className="text-xs text-zinc-400">Library Reference</Label>
      {value ? (
        <InlineSkillRefDisplay skillRef={value} onDetach={() => onChange(null)} />
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
          Link to library skill
        </Button>
      )}
      {value && (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
          Change library skill
        </Button>
      )}
      <SkillPickerDialog
        open={open}
        onOpenChange={setOpen}
        onSelect={(ref) => onChange(ref)}
        currentRef={value}
      />
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function VersionInput({ className, ...rest }: InputProps) {
  return <Input className={className} {...rest} />;
}
