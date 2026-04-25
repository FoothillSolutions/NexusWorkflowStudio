"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SkillRecord, ValidationWarning } from "@/lib/library-store/types";

interface SkillDetailPanelProps {
  skills: SkillRecord[];
  validationWarnings: ValidationWarning[];
  onPublishSkill: (skillId: string) => void;
  onDeleteSkill: (skillId: string) => void;
}

export function SkillDetailPanel({ skills, validationWarnings, onPublishSkill, onDeleteSkill }: SkillDetailPanelProps) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Skills</div>
        {skills.length === 0 ? (
          <p className="text-xs text-zinc-600 italic">No skills yet.</p>
        ) : (
          <ul className="space-y-2">
            {skills.map((skill) => (
              <li key={skill.id} className="rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-zinc-100">{skill.name}</div>
                    <div className="text-[11px] font-mono text-zinc-500">{skill.skillKey}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onPublishSkill(skill.id)}>
                      Publish
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => onDeleteSkill(skill.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                {skill.description && <p className="mt-1 text-xs text-zinc-400">{skill.description}</p>}
                {skill.deprecated && <Badge variant="outline" className="mt-1 text-[10px] text-amber-300">deprecated</Badge>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Validation</div>
        {validationWarnings.length === 0 ? (
          <p className="text-xs text-emerald-400">All clean.</p>
        ) : (
          <ul className="space-y-1">
            {validationWarnings.map((w, i) => (
              <li key={i} className={`rounded-md border px-2 py-1.5 text-xs ${w.level === "error" ? "border-red-700 bg-red-950/30 text-red-200" : "border-amber-700 bg-amber-950/30 text-amber-200"}`}>
                <div className="font-mono text-[10px] uppercase">{w.code}</div>
                <div>{w.message}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
